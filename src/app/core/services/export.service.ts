import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShoppingListItem } from './meal-plan.service';

export interface ExportOptions {
  title?: string;
  groupBy?: 'category' | 'recipe' | 'none';
  includeChecked?: boolean;
  showInventory?: boolean;
  showRecipes?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  /**
   * Export shopping list to PDF
   */
  exportToPdf(items: ShoppingListItem[], options: ExportOptions = {}): void {
    const {
      title = 'Shopping List',
      groupBy = 'none',
      includeChecked = false,
      showInventory = true,
      showRecipes = true,
    } = options;

    // Create PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    // Add date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(dateStr, pageWidth / 2, 28, { align: 'center' });

    // Prepare table data
    const headers = ['Item', 'Quantity'];
    if (showInventory) headers.push('In Stock');
    if (showRecipes) headers.push('For Recipes');

    const tableData = items.map(item => {
      const row: any[] = [
        item.ingredientName,
        `${this.formatQuantity(item.needed > 0 ? item.needed : item.totalQuantity, item.unit)}`,
      ];

      if (showInventory) {
        row.push(
          item.inventoryQuantity > 0
            ? this.formatQuantity(item.inventoryQuantity, item.unit)
            : '-'
        );
      }

      if (showRecipes) {
        row.push(item.mealPlans.slice(0, 2).join(', ') + (item.mealPlans.length > 2 ? '...' : ''));
      }

      return row;
    });

    // Generate table
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: {
        fillColor: [67, 160, 71], // Primary green
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30, halign: 'right' },
      },
      didDrawPage: (data) => {
        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Page ${pageNumber} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });

    // Add summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary:', 14, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total items: ${items.length}`, 14, finalY + 6);
    doc.text(
      `Need to buy: ${items.filter(i => i.needed > 0).length}`,
      14,
      finalY + 12
    );
    doc.text(
      `Already in stock: ${items.filter(i => i.needed === 0).length}`,
      14,
      finalY + 18
    );

    // Save PDF
    const fileName = `shopping-list-${this.formatDateForFilename()}.pdf`;
    doc.save(fileName);
  }

  /**
   * Export shopping list to CSV
   */
  exportToCsv(items: ShoppingListItem[], options: ExportOptions = {}): void {
    const {
      title = 'Shopping List',
      showInventory = true,
      showRecipes = true,
    } = options;

    // Build CSV content
    let csv = `${title}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Headers
    const headers = ['Item', 'Total Quantity', 'Unit', 'Need to Buy'];
    if (showInventory) headers.push('In Stock');
    if (showRecipes) headers.push('For Recipes');
    csv += headers.join(',') + '\n';

    // Data rows
    for (const item of items) {
      const row: string[] = [
        this.escapeCsv(item.ingredientName),
        item.totalQuantity.toString(),
        this.escapeCsv(item.unit),
        item.needed.toString(),
      ];

      if (showInventory) {
        row.push(item.inventoryQuantity.toString());
      }

      if (showRecipes) {
        row.push(this.escapeCsv(item.mealPlans.join('; ')));
      }

      csv += row.join(',') + '\n';
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shopping-list-${this.formatDateForFilename()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generate print-ready HTML for shopping list
   */
  generatePrintHtml(items: ShoppingListItem[], options: ExportOptions = {}): string {
    const {
      title = 'Shopping List',
      showInventory = true,
      showRecipes = true,
    } = options;

    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
            @page { margin: 1cm; }
          }

          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }

          h1 {
            text-align: center;
            color: #43a047;
            margin-bottom: 5px;
          }

          .date {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }

          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }

          th {
            background-color: #43a047;
            color: white;
            font-weight: bold;
          }

          tr:nth-child(even) {
            background-color: #f5f5f5;
          }

          tr:hover {
            background-color: #e8f5e9;
          }

          .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid #43a047;
            display: inline-block;
            margin-right: 10px;
            vertical-align: middle;
          }

          .summary {
            background-color: #e8f5e9;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
          }

          .summary h3 {
            margin-top: 0;
            color: #43a047;
          }

          .summary p {
            margin: 5px 0;
          }

          .print-button {
            background-color: #43a047;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-bottom: 20px;
          }

          .print-button:hover {
            background-color: #388e3c;
          }
        </style>
      </head>
      <body>
        <button class="print-button no-print" onclick="window.print()">🖨️ Print</button>

        <h1>${title}</h1>
        <div class="date">${dateStr}</div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">☐</th>
              <th>Item</th>
              <th style="width: 120px;">Quantity</th>
              ${showInventory ? '<th style="width: 100px;">In Stock</th>' : ''}
              ${showRecipes ? '<th>For Recipes</th>' : ''}
            </tr>
          </thead>
          <tbody>
    `;

    for (const item of items) {
      const needToBuy = item.needed > 0;
      html += `
        <tr>
          <td><span class="checkbox"></span></td>
          <td><strong>${this.escapeHtml(item.ingredientName)}</strong></td>
          <td>${this.formatQuantity(needToBuy ? item.needed : item.totalQuantity, item.unit)}</td>
          ${
            showInventory
              ? `<td>${
                  item.inventoryQuantity > 0
                    ? this.formatQuantity(item.inventoryQuantity, item.unit)
                    : '-'
                }</td>`
              : ''
          }
          ${
            showRecipes
              ? `<td style="font-size: 12px; color: #666;">${this.escapeHtml(
                  item.mealPlans.slice(0, 3).join(', ')
                )}</td>`
              : ''
          }
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>

        <div class="summary">
          <h3>Summary</h3>
          <p><strong>Total items:</strong> ${items.length}</p>
          <p><strong>Need to buy:</strong> ${items.filter(i => i.needed > 0).length}</p>
          <p><strong>Already in stock:</strong> ${items.filter(i => i.needed === 0).length}</p>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Open print dialog with shopping list
   */
  printShoppingList(items: ShoppingListItem[], options: ExportOptions = {}): void {
    const html = this.generatePrintHtml(items, options);
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Auto-print after a short delay to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      alert('Please allow popups to print the shopping list');
    }
  }

  /**
   * Export meal plan summary to PDF
   */
  exportMealPlanToPdf(
    mealPlans: Array<{ date: string; mealType: string; recipeName: string; servings: number }>,
    dateRange: { start: string; end: string }
  ): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Meal Plan', pageWidth / 2, 20, { align: 'center' });

    // Date range
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dateRange.start} to ${dateRange.end}`, pageWidth / 2, 28, { align: 'center' });

    // Table
    const tableData = mealPlans.map(plan => [
      plan.date,
      plan.mealType,
      plan.recipeName,
      plan.servings.toString(),
    ]);

    autoTable(doc, {
      head: [['Date', 'Meal', 'Recipe', 'Servings']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: {
        fillColor: [67, 160, 71],
        textColor: 255,
        fontStyle: 'bold',
      },
    });

    doc.save(`meal-plan-${this.formatDateForFilename()}.pdf`);
  }

  /**
   * Helper: Format quantity with unit
   */
  private formatQuantity(quantity: number, unit: string): string {
    return `${quantity.toFixed(2).replace(/\.00$/, '')} ${unit}`;
  }

  /**
   * Helper: Format date for filename
   */
  private formatDateForFilename(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Helper: Escape CSV field
   */
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Helper: Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
