export default function OutputPrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @page {
            margin: 0.75in;
          }

          @media print {
            html, body {
              background: #ffffff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .vet-output-no-print {
              display: none !important;
            }

            .vet-output-shell {
              max-width: none !important;
            }

            .vet-report-document {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
            }

            .report-cover-page {
              break-after: page;
              page-break-after: always;
            }

            .report-cover-page img {
              width: 100%;
              height: 100vh;
              object-fit: cover;
            }

            .report-strategy-cover {
              break-after: page;
              page-break-after: always;
            }

            .report-section-break {
              break-before: page;
              page-break-before: always;
            }

            .vet-output-print-strategy-banner {
              display: block !important;
            }
          }
        `,
      }}
    />
  );
}
