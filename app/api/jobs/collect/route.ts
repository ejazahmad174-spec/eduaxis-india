          .update({
            pdf_url: pdfUrl,
            extraction_status: "processing",
            extraction_error: null,
          })
          .eq("id", discovery.id)
          .eq("extraction_status", "pending");

        if (processingError) {
          console.error(
            "Could not mark PDF as processing:",
            processingError
          );
          continue;
        }

        const pdfResult = await readJobPDF(pdfUrl);

        if (!pdfResult.success) {
          const needsOcr =
            pdfResult.error?.toLowerCase().includes("very little text") ||
            false;

          const { error: failureUpdateError } = await supabase
            .from("government_job_discoveries")
            .update({
              pdf_url: pdfUrl,
              extraction_status: needsOcr ? "needs_ocr" : "failed",
              extraction_error:
                pdfResult.error || "PDF reading failed.",
              extracted_at: new Date().toISOString(),
            })
            .eq("id", discovery.id);

          if (failureUpdateError) {
            console.error(
              "Could not save PDF extraction failure:",
              failureUpdateError
            );
          }

          continue;
        }

        const extractedDetails = extractJobDetails(
          pdfResult.text,
          pdfUrl
        );

        const { error: updateError } = await supabase
          .from("government_job_discoveries")
          .update({
            pdf_url: pdfUrl,
            extracted_details: {
              ...extractedDetails,
              pdf_pages: pdfResult.pages,
            },
            extraction_status: "completed",
            extraction_error: null,
            extracted_at: new Date().toISOString(),
          })
          .eq("id", discovery.id);

        if (updateError) {
          console.error(
            "Could not save extracted PDF details:",
            updateError
          );
        } else {
          pdfsSuccessful++;
          sourcePdfsRead++;
        }
      }

      const now = new Date().toISOString();

      await supabase
        .from("government_job_sources")
        .update({
          last_checked_at: now,
          last_success_at: now,
          last_error: null,
          updated_at: now,
        })
        .eq("id", source.id);

      results.push({
        source: source.source_name,
        pages_checked: pagesChecked,
        found: links.length,
        pdfs_read: sourcePdfsRead,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        "Job source collection failed:",
        source.source_name,
        message
      );

      await supabase
        .from("government_job_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_error: message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", source.id);

      results.push({
        source: source.source_name,
        pages_checked: 0,
        found: 0,
        pdfs_read: 0,
        error: message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: "Government job discovery and PDF extraction completed.",
    sources_checked: checked,
    candidate_links_found: discovered,
    pdfs_processed: pdfsProcessed,
    pdfs_successfully_read: pdfsSuccessful,
