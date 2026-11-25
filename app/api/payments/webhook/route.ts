
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { notifyStudentOfRefund } from "@/lib/refund-notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !webhookSecret ||
      !supabaseUrl ||
      !serviceKey ||
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      return NextResponse.json(
        { error: "Webhook configuration is incomplete." },
        { status: 500 }
      );
    }

    // Verify the original Razorpay webhook request.
    const rawBody = await request.text();
    const receivedSignature =
      request.headers.get("x-razorpay-signature");

    if (
      !receivedSignature ||
      !/^[a-f0-9]{64}$/i.test(receivedSignature)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid webhook signature." },
        { status: 400 }
      );
    }

    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(receivedSignature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // --------------------------------------------------
    // 1. HANDLE SUCCESSFULLY PROCESSED REFUNDS
    // --------------------------------------------------

    if (event.event === "refund.processed") {
      const refund = event?.payload?.refund?.entity;

      if (!refund?.id || !refund?.payment_id || !refund?.amount) {
        return NextResponse.json(
          { error: "Refund details are missing." },
          { status: 400 }
        );
      }

      // Independently verify the refund with Razorpay.
      const verifiedRefund = await razorpay.refunds.fetch(refund.id);

      if (
        verifiedRefund.id !== refund.id ||
        verifiedRefund.payment_id !== refund.payment_id ||
        verifiedRefund.amount !== Number(refund.amount) ||
        verifiedRefund.status !== "processed"
      ) {
        console.error("Razorpay refund verification mismatch.");

        return NextResponse.json(
          { error: "Refund details could not be verified." },
          { status: 400 }
        );
      }

      // Find the original EduAxis payment.
      const { data: order, error: orderError } = await adminClient
        .from("payment_orders")
        .select("*")
        .eq("razorpay_payment_id", verifiedRefund.payment_id)
        .maybeSingle();

      if (orderError) {
        console.error("Refund order lookup failed:", orderError);

        return NextResponse.json(
          { error: "Could not find the original payment." },
          { status: 500 }
        );
      }

      if (order) {
        // Mock-test refund: preserve the existing mock-test refund handler.
        const { data: refundResult, error: refundError } =
          await adminClient.rpc("process_mock_test_refund", {
            p_refund_id: verifiedRefund.id,
            p_payment_id: verifiedRefund.payment_id,
            p_amount_paise: verifiedRefund.amount,
          });

        if (refundError || !refundResult?.success) {
          console.error("Mock-test refund processing failed:", refundError);
          return NextResponse.json(
            { error: "Refund recording failed. Retry required." },
            { status: 500 }
          );
        }

        const actionId = verifiedRefund.notes?.eduaxis_refund_action_id;
        const actionUpdate = typeof actionId === "string"
          ? await adminClient.from("admin_refund_actions").update({
              status: "processed",
              razorpay_refund_id: verifiedRefund.id,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", actionId)
          : await adminClient.from("admin_refund_actions").update({
              status: "processed",
              razorpay_refund_id: verifiedRefund.id,
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("razorpay_refund_id", verifiedRefund.id);

        if (actionUpdate.error) {
          console.error("Admin refund action could not be reconciled:", actionUpdate.error);
          return NextResponse.json({ error: "Refund was recorded but admin audit reconciliation failed." }, { status: 500 });
        }

        const [studentResult, testResult] = await Promise.all([
          adminClient.from("profiles").select("email").eq("id", order.student_id).maybeSingle(),
          adminClient.from("mock_tests").select("title").eq("id", order.mock_test_id).maybeSingle(),
        ]);
        if (studentResult.error || testResult.error) {
          console.error("Refund notification details could not be loaded:", studentResult.error || testResult.error);
          return NextResponse.json({ error: "Refund was recorded but student notification details could not be loaded." }, { status: 500 });
        }

        await notifyStudentOfRefund(adminClient, {
          studentId: order.student_id,
          studentEmail: studentResult.data?.email || null,
          refundId: verifiedRefund.id,
          status: "processed",
          amountPaise: verifiedRefund.amount,
          productTitle: testResult.data?.title || "Mock Test",
          categoryLabel: "Mock Test",
          orderReference: order.id,
        });

        return NextResponse.json({
          received: true,
          success: true,
          fully_refunded: refundResult.fully_refunded,
          message: refundResult.message,
        });
      }

      // Study-material refunds use their own entitlement ledger.
      const { data: materialOrder, error: materialOrderError } = await adminClient
        .from("study_material_payment_orders")
        .select("id,user_id,study_material_id")
        .eq("razorpay_payment_id", verifiedRefund.payment_id)
        .maybeSingle();

      if (materialOrderError) {
        console.error("Study-material refund order lookup failed:", materialOrderError);
        return NextResponse.json(
          { error: "Could not find the original PDF payment." },
          { status: 500 }
        );
      }

      // Ignore refunds that do not belong to any EduAxis payment table.
      if (!materialOrder) {
        return NextResponse.json({ received: true });
      }

      const { data: materialRefundResult, error: materialRefundError } =
        await adminClient.rpc("process_study_material_refund", {
          p_refund_id: verifiedRefund.id,
          p_payment_id: verifiedRefund.payment_id,
          p_amount_paise: verifiedRefund.amount,
        });

      if (materialRefundError || !materialRefundResult?.success) {
        console.error("Study-material refund processing failed:", materialRefundError);
        return NextResponse.json(
          { error: "PDF refund recording failed. Retry required." },
          { status: 500 }
        );
      }

      const materialActionId = verifiedRefund.notes?.eduaxis_refund_action_id;
      const materialActionUpdate = typeof materialActionId === "string"
        ? await adminClient.from("admin_refund_actions").update({
            status: "processed",
            razorpay_refund_id: verifiedRefund.id,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", materialActionId)
        : await adminClient.from("admin_refund_actions").update({
            status: "processed",
            razorpay_refund_id: verifiedRefund.id,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("razorpay_refund_id", verifiedRefund.id);

      if (materialActionUpdate.error) {
        console.error("Study-material admin refund action reconciliation failed:", materialActionUpdate.error);
        return NextResponse.json({ error: "PDF refund was recorded but audit reconciliation failed." }, { status: 500 });
      }

      const [materialStudent, materialProduct] = await Promise.all([
        adminClient.from("profiles").select("email").eq("id", materialOrder.user_id).maybeSingle(),
        adminClient.from("study_materials").select("title").eq("id", materialOrder.study_material_id).maybeSingle(),
      ]);
      if (materialStudent.error || materialProduct.error) {
        console.error("Study-material refund notification details failed:", materialStudent.error || materialProduct.error);
        return NextResponse.json({ error: "PDF refund was recorded but notification details could not be loaded." }, { status: 500 });
      }

      await notifyStudentOfRefund(adminClient, {
        studentId: materialOrder.user_id,
        studentEmail: materialStudent.data?.email || null,
        refundId: verifiedRefund.id,
        status: "processed",
        amountPaise: verifiedRefund.amount,
        productTitle: materialProduct.data?.title || "Study Material",
        categoryLabel: "Study Material",
        orderReference: materialOrder.id,
      });

      return NextResponse.json({
        received: true,
        success: true,
        fully_refunded: materialRefundResult.fully_refunded,
        message: materialRefundResult.message,
      });
    }

    // --------------------------------------------------
    // 2. HANDLE EXISTING PAYMENT EVENTS
    // --------------------------------------------------

    if (
      !["payment.captured", "payment.failed"].includes(event.event)
    ) {
      return NextResponse.json({ received: true });
    }

    const payment = event?.payload?.payment?.entity;

    if (!payment?.id || !payment?.order_id) {
      return NextResponse.json(
        { error: "Payment details are missing." },
        { status: 400 }
      );
    }

    const { data: mockTestOrder, error: orderError } = await adminClient
      .from("payment_orders")
      .select("id,amount_paise,currency,razorpay_order_id,razorpay_payment_id,status")
      .eq("razorpay_order_id", payment.order_id)
      .maybeSingle();

    if (orderError) {
      console.error("Webhook order lookup failed:", orderError);
      return NextResponse.json(
        { error: "Could not look up the payment order." },
        { status: 500 }
      );
    }

    let paymentIsStudyMaterial = false;
    let order: {
      id: string;
      amount_paise: number;
      currency: string;
      razorpay_order_id: string | null;
      razorpay_payment_id: string | null;
      status: string;
    } | null = mockTestOrder
      ? {
          id: mockTestOrder.id,
          amount_paise: Number(mockTestOrder.amount_paise),
          currency: mockTestOrder.currency,
          razorpay_order_id: mockTestOrder.razorpay_order_id,
          razorpay_payment_id: mockTestOrder.razorpay_payment_id,
          status: mockTestOrder.status,
        }
      : null;

    if (!order) {
      const { data: studyMaterialOrder, error: studyMaterialOrderError } = await adminClient
        .from("study_material_payment_orders")
        .select("id,amount_paise,currency,razorpay_order_id,razorpay_payment_id,status")
        .eq("razorpay_order_id", payment.order_id)
        .maybeSingle();

      if (studyMaterialOrderError) {
        console.error("Study-material webhook order lookup failed:", studyMaterialOrderError);
        return NextResponse.json(
          { error: "Could not look up the PDF payment order." },
          { status: 500 }
        );
      }

      if (!studyMaterialOrder) {
        return NextResponse.json({ received: true });
      }

      order = {
        id: studyMaterialOrder.id,
        amount_paise: Number(studyMaterialOrder.amount_paise),
        currency: studyMaterialOrder.currency,
        razorpay_order_id: studyMaterialOrder.razorpay_order_id,
        razorpay_payment_id: studyMaterialOrder.razorpay_payment_id,
        status: studyMaterialOrder.status,
      };
      paymentIsStudyMaterial = true;
    }

    // A failed payment must never overwrite a successful payment.
    if (event.event === "payment.failed") {
      if (order.status === "pending") {
        const failureUpdate = paymentIsStudyMaterial
          ? await adminClient
              .from("study_material_payment_orders")
              .update({ status: "failed", updated_at: new Date().toISOString() })
              .eq("id", order.id)
              .eq("status", "pending")
          : await adminClient
              .from("payment_orders")
              .update({ status: "failed" })
              .eq("id", order.id)
              .eq("status", "pending");

        if (failureUpdate.error) {
          console.error("Could not record failed payment:", failureUpdate.error);
          return NextResponse.json(
            { error: "Could not record payment failure." },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ received: true });
    }

    // Only captured payments can activate a purchase.
    if (payment.status !== "captured") {
      return NextResponse.json({ received: true });
    }

    if (order.status === "refunded") {
      return NextResponse.json({ received: true });
    }

    if (
      order.razorpay_payment_id &&
      order.razorpay_payment_id !== payment.id
    ) {
      console.error("Webhook payment ID mismatch.");

      return NextResponse.json(
        { error: "Payment ID does not match the order." },
        { status: 409 }
      );
    }

    // Independently confirm payment details with Razorpay.
    const verifiedPayment = await razorpay.payments.fetch(payment.id);

    if (
      verifiedPayment.status !== "captured" ||
      verifiedPayment.order_id !== order.razorpay_order_id ||
      verifiedPayment.amount !== Number(order.amount_paise) ||
      verifiedPayment.currency !== order.currency
    ) {
      console.error("Razorpay payment verification mismatch.");

      return NextResponse.json(
        { error: "Payment details do not match the order." },
        { status: 400 }
      );
    }

    const { data: activation, error: activationError } = paymentIsStudyMaterial
      ? await adminClient.rpc("activate_study_material_purchase", {
          p_payment_order_id: order.id,
          p_razorpay_payment_id: payment.id,
        })
      : await adminClient.rpc("activate_mock_test_purchase", {
          p_payment_order_id: order.id,
          p_razorpay_payment_id: payment.id,
        });

    if (activationError) {
      console.error("Webhook purchase activation failed:", activationError);

      return NextResponse.json(
        { error: "Payment received, but purchase activation needs retry." },
        { status: 500 }
      );
    }

    if (activation?.requires_review) {
      console.error("Payment requires manual purchase review:", order.id);

      return NextResponse.json(
        { error: "Payment recorded but purchase requires review." },
        { status: 500 }
      );
    }

    if (!activation?.success) {
      return NextResponse.json(
        { error: "Purchase activation could not be confirmed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      success: true,
      message: activation.message,
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      { error: "Unable to process webhook." },
      { status: 500 }
    );
  }
}
