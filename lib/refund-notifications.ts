import type { SupabaseClient } from "@supabase/supabase-js";

export type RefundNotificationStatus = "pending" | "processed" | "failed" | "awaiting_funds";

type RefundNotificationInput = {
  studentId: string;
  studentEmail: string | null;
  refundId: string;
  status: RefundNotificationStatus;
  amountPaise: number;
  productTitle: string;
  categoryLabel: string;
  orderReference: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] || character;
  });
}

function money(paise: number) {
  return (Number(paise || 0) / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function notifyStudentOfRefund(
  adminClient: SupabaseClient,
  input: RefundNotificationInput,
) {
  const statusCopy: Record<RefundNotificationStatus, { title: string; phrase: string }> = {
    pending: {
      title: "Refund initiated",
      phrase: "Your refund has been initiated and is being processed by the payment provider.",
    },
    awaiting_funds: {
      title: "Refund approved — awaiting funds",
      phrase: "Your refund request is approved and the full amount is reserved in the EduAxis refund queue. Razorpay has not processed it yet because the merchant balance is insufficient. We will retry when sufficient funds are available; you do not need to submit another request.",
    },
    processed: {
      title: "Refund processed",
      phrase: "Your refund has been processed by the payment provider. Your bank may take additional working days to show the credit.",
    },
    failed: {
      title: "Refund could not be processed",
      phrase: "Your refund could not be processed. Please contact EduAxis India support for assistance.",
    },
  };

  const copy = statusCopy[input.status];
  const amount = money(input.amountPaise);
  const message = `${copy.phrase} Amount: ${amount}. Resource: ${input.productTitle}. Reference: ${input.orderReference}.`;
  const sourceReference = `refund:${input.refundId}:${input.status}`;

  const { error: notificationError } = await adminClient
    .from("student_notifications")
    .insert({
      student_id: input.studentId,
      title: copy.title,
      message,
      notification_type: "account",
      link_url: "/student/dashboard",
      source_reference: sourceReference,
    });

  const duplicateNotification = notificationError?.code === "23505";
  if (notificationError && !duplicateNotification) {
    console.error("Refund in-app notification failed:", notificationError);
  }

  if (duplicateNotification) {
    return {
      inApp: "already_sent" as const,
      email: "skipped_duplicate" as const,
    };
  }

  if (notificationError) {
    return {
      inApp: "failed" as const,
      email: "not_attempted" as const,
    };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  if (!input.studentEmail || !resendApiKey || !resendFromEmail) {
    return {
      inApp: "sent" as const,
      email: "not_configured" as const,
    };
  }

  const safeTitle = escapeHtml(input.productTitle);
  const safeCategory = escapeHtml(input.categoryLabel);
  const safeReference = escapeHtml(input.orderReference);
  const safeAmount = escapeHtml(amount);
  const safePhrase = escapeHtml(copy.phrase);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": sourceReference,
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [input.studentEmail],
        subject: `EduAxis India: ${copy.title}`,
        text: [
          "Hello,",
          "",
          copy.phrase,
          `Amount: ${amount}`,
          `Resource: ${input.productTitle}`,
          `Category: ${input.categoryLabel}`,
          `Reference: ${input.orderReference}`,
          "",
          "EduAxis India Support",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;color:#18324b;line-height:1.6;max-width:620px;margin:auto">
            <h2 style="color:#102d49">EduAxis India</h2>
            <h3>${escapeHtml(copy.title)}</h3>
            <p>${safePhrase}</p>
            <p><b>Amount:</b> ${safeAmount}<br/>
            <b>Resource:</b> ${safeTitle}<br/>
            <b>Category:</b> ${safeCategory}<br/>
            <b>Reference:</b> ${safeReference}</p>
            <p>Thank you,<br/>EduAxis India Support</p>
          </div>
        `,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Refund email delivery failed:", response.status, detail.slice(0, 500));
      return {
        inApp: "sent" as const,
        email: "failed" as const,
      };
    }

    return {
      inApp: "sent" as const,
      email: "sent" as const,
    };
  } catch (error) {
    console.error("Refund email delivery error:", error);
    return {
      inApp: "sent" as const,
      email: "failed" as const,
    };
  }
}
