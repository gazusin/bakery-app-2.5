import * as XLSX from 'xlsx';

/**
 * Export a single array of objects to an Excel file
 * @param data Array of objects to export
 * @param fileName Name of the file (without extension)
 * @param sheetName Name of the sheet
 */
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * Export multiple arrays of objects to separate sheets in a single Excel file
 * @param sheets Array of objects containing data and sheetName
 * @param fileName Name of the file (without extension)
 */
export const exportMultipleSheetsToExcel = (sheets: { data: any[], sheetName: string }[], fileName: string) => {
    const workbook = XLSX.utils.book_new();
    sheets.forEach(sheet => {
        const worksheet = XLSX.utils.json_to_sheet(sheet.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
    });
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
