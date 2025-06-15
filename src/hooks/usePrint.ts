
import { useCallback } from 'react';

export const usePrint = () => {
  const printContent = useCallback((content: string, title: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString('it-IT');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @media print {
              * { -webkit-print-color-adjust: exact; }
              @page { 
                margin: 2cm;
                size: A4;
              }
            }
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.4;
              color: #000;
              background: white;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .header p {
              margin: 5px 0;
              font-size: 14px;
            }
            .footer {
              position: fixed;
              bottom: 1cm;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 12px;
              border-top: 1px solid #ccc;
              padding-top: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
              text-align: center;
            }
            .badge {
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 10px;
              font-weight: bold;
            }
            .badge-success { background-color: #d4edda; color: #155724; }
            .badge-warning { background-color: #fff3cd; color: #856404; }
            .badge-danger { background-color: #f8d7da; color: #721c24; }
            .badge-info { background-color: #d1ecf1; color: #0c5460; }
            .summary {
              background-color: #f8f9fa;
              padding: 15px;
              border: 1px solid #dee2e6;
              margin: 20px 0;
            }
            .summary h3 {
              margin-top: 0;
              color: #495057;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-green { color: #28a745; }
            .text-red { color: #dc3545; }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Associazione</h1>
            <p>${title}</p>
            <p>Data di stampa: ${currentDate}</p>
          </div>
          ${content}
          <div class="footer">
            <p>Documento generato automaticamente - Pagina <span id="pageNum"></span></p>
          </div>
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, []);

  return { printContent };
};
