'use server';
/**
 * @fileOverview An AI flow to process invoice images and extract structured data.
 *
 * - processInvoice - A function that handles the invoice processing.
 * - ProcessInvoiceInput - The input type for the processInvoice function.
 * - ProcessInvoiceOutput - The return type for the processInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ProcessInvoiceInputSchema = z.object({
  invoiceImageUri: z
    .string()
    .describe(
      "A photo of a purchase invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  availableSuppliers: z.array(z.string()).optional().describe('A list of known supplier names in the system.'),
  availableRawMaterials: z.array(z.string()).optional().describe('A list of known raw material names in the system.'),
});
export type ProcessInvoiceInput = z.infer<typeof ProcessInvoiceInputSchema>;

const ProcessedInvoiceItemSchema = z.object({
    description: z.string().describe('The name of the raw material from the provided `availableRawMaterials` list that is the closest match to the item described on the invoice. Example: If invoice says "clavito dulce", match it to "Clavos de Olor" from the list.'),
    quantity: z.number().describe('The quantity of the item.'),
    unit: z.string().describe('The unit of measure for the item as it appears on the invoice (e.g., und, kg, saco, caja, bulto).'),
    unitPrice: z.number().describe('The price per unit for the item in VES (Bolívares).'),
    subtotal: z.number().describe('The total price for the line item (quantity * unitPrice) in VES (Bolívares).')
});

const ProcessInvoiceOutputSchema = z.object({
  invoiceId: z.string().optional().describe('The invoice number or identifier. Can be called FACTURA NRO, NOTA DE ENTREGA, etc. IMPORTANT: Extract ALL numerical digits, including any leading zeros. For example, if it says "FACTURA NRO: 00-12345", you must return "0012345".'),
  supplierName: z.string().optional().describe('The name of the supplier from the provided `availableSuppliers` list that is the closest match to the supplier on the invoice.'),
  orderDate: z.string().describe('The date of the invoice in YYYY-MM-DD format.'),
  totalCost: z.number().describe('The final total amount of the invoice, usually labeled as TOTAL, in VES (Bolívaíres).'),
  items: z.array(ProcessedInvoiceItemSchema).describe('A list of all line items from the invoice.'),
  analysisNotes: z.string().optional().describe('Brief notes about the analysis process, such as difficulties encountered matching items or suppliers. Explain WHY you could not match something if that was the case.')
});
export type ProcessInvoiceOutput = z.infer<typeof ProcessInvoiceOutputSchema>;

export async function processInvoice(input: ProcessInvoiceInput): Promise<ProcessInvoiceOutput> {
  return processInvoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processInvoicePrompt',
  input: {schema: ProcessInvoiceInputSchema},
  output: {schema: ProcessInvoiceOutputSchema},
  prompt: `You are an expert data entry assistant for a bakery. Your task is to analyze the provided invoice image and extract key information. The invoice currency is always VES (Bolívares).

**CRITICAL INSTRUCTIONS:**
1.  **Fuzzy Matching:** You will be given lists of known suppliers and raw materials. Your primary goal is to find the closest possible match from these lists. For example, if the invoice says "clavito dulce" and the raw materials list has "Clavos de Olor", you MUST select "Clavos de Olor" as the description. If the supplier is "Distribuidora La Central C.A" and the list has "La Central", you MUST select "La Central".
2.  **Fallback:** If you CANNOT find a reasonable match for a raw material in the provided list, return the description exactly as you read it from the invoice. **DO NOT leave the items array empty if you see items on the invoice.**
3.  **Feedback:** Use the 'analysisNotes' field to provide feedback. If everything is clear, say "Análisis completado exitosamente". If you had to use the fallback text for an item because you couldn't find a match, mention it, e.g., "No se encontró coincidencia para 'clavito dulce', se usó el texto original.". If you are unsure about the supplier, mention that too.

**DATA TO EXTRACT:**
- **Invoice Number:** Labeled "FACTURA NRO", "NOTA DE ENTREGA", "PEDIDO", etc. **Extract ALL numerical digits from the identifier, including any leading zeros. Ignore non-digit characters.** For example, if it says "FACTURA NRO: 00-12345", extract "0012345".
- **Supplier Name:** Find the best match from the provided supplier list.
- **Invoice Date:** Convert to YYYY-MM-DD format.
- **Line Items:** Capture EVERY line item. For each:
    - \`description\`: The best match from the \`availableRawMaterials\` list (or original text as fallback).
    - \`quantity\`: The quantity.
    - \`unit\`: The unit of measure (e.g., kg, und, saco, bulto, caja).
    - \`unitPrice\`: The price per unit in VES.
    - \`subtotal\`: The total price for the line item in VES.
- **Total Cost:** The final total amount, usually labeled "TOTAL", in VES.
- **Analysis Notes:** Your feedback on the process.

**REFERENCE LISTS:**
Known Suppliers:
{{#each availableSuppliers}}
- {{{this}}}
{{/each}}

Known Raw Materials:
{{#each availableRawMaterials}}
- {{{this}}}
{{/each}}

**INPUT IMAGE:**
{{media url=invoiceImageUri}}

Provide the response strictly in the requested JSON format.`,
});

const processInvoiceFlow = ai.defineFlow(
  {
    name: 'processInvoiceFlow',
    inputSchema: ProcessInvoiceInputSchema,
    outputSchema: ProcessInvoiceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to process invoice. The AI model did not return a valid output.');
    }
    return output;
  }
);
