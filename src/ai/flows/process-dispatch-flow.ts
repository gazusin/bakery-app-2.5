'use server';
/**
 * @fileOverview An AI flow to process a full day's dispatch text and extract multiple sales.
 *
 * - processDispatch - A function that handles dispatch processing.
 * - ProcessDispatchInput - The input type for the processDispatch function.
 * - ProcessDispatchOutput - The return type for the processDispatch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProcessDispatchInputSchema = z.object({
  dispatchText: z
    .string()
    .describe('The full text content of a daily dispatch note for a bakery.'),
  availableCustomers: z.array(z.string()).optional().describe('A list of known customer names in the system.'),
  availableProducts: z.array(z.string()).optional().describe('A list of known final product names in the system (vendible products).'),
});
export type ProcessDispatchInput = z.infer<typeof ProcessDispatchInputSchema>;

const DispatchSaleItemSchema = z.object({
  productName: z.string().describe('The name of the product from the `availableProducts` list that is the closest match to the item described. Apply aliases: "redondo" is "pan dulce", "largo" is "pan morocho".'),
  quantity: z.number().describe('The quantity of the item.'),
});

const DispatchSaleSchema = z.object({
    customerName: z.string().describe('The name of the customer from the `availableCustomers` list that is the closest match to the customer name in the dispatch text (e.g., match "Comino" to "Cliente Comino").'),
    items: z.array(DispatchSaleItemSchema).describe('A list of all items sold to this customer.'),
    changes: z.array(DispatchSaleItemSchema).optional().describe('A list of all items returned or changed by this customer. This includes items under "cambio", "devolucion", "pan bueno", and "pan malo".'),
    notes: z.string().optional().describe('Any notes or comments specific to this customer\'s dispatch.')
});

const ProcessDispatchOutputSchema = z.object({
  dispatchDate: z.string().optional().describe('The date of the dispatch, if mentioned at the top of the text, in YYYY-MM-DD format. If only day and month are provided (e.g., "18/09"), assume the current year (2025) and format as "2025-09-18".'),
  sales: z.array(DispatchSaleSchema).describe('An array of all the individual sales extracted from the dispatch text.'),
  analysisNotes: z.string().optional().describe('Tus comentarios sobre el proceso en español. Por ejemplo, dificultades encontradas al buscar productos o clientes. Si todo está claro, di "Despacho analizado exitosamente."')
});
export type ProcessDispatchOutput = z.Dotted<typeof ProcessDispatchOutputSchema>;


export async function processDispatch(input: ProcessDispatchInput): Promise<ProcessDispatchOutput> {
  return processDispatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processDispatchPrompt',
  input: { schema: ProcessDispatchInputSchema },
  output: { schema: ProcessDispatchOutputSchema },
  prompt: `You are an expert data entry assistant for a bakery. Your task is to analyze the provided dispatch text and extract all individual sales for the day.

**CRITICAL INSTRUCTIONS:**
1.  **Customer & Product Matching:** You will be given lists of known customers and products. You MUST find the closest possible match from these lists.
    - **Customer:** Match names like "Comino", "Dito", "Joseito", "Erne" to their full names in the 'availableCustomers' list.
    - **Product Aliases:** You MUST apply these aliases: "redondo" is "pan dulce". "largo" is "pan morocho".
2.  **Sales & Changes:** For each customer, identify the items they bought (sale) and the items they returned (changes/devolutions).
    - **Sales:** Standard list of products under a customer's name.
    - **Changes/Devoluciones:** Items listed under keywords like "cambio", "devolucion", "pan malo", or "pan bueno".
    - **"Pan Malo":** If an item is marked as "pan malo" or is a return of a product that sounds like a bad product, you must find the corresponding "No despachable" version of that product in the 'availableProducts' list. For example, if "pan de queso" is returned as "pan malo", you MUST match it to the product "No despachable Pan de queso".
    - **"Pan Bueno" / "Cambio":** If an item is a "cambio" or "devolucion" or "pan bueno", match it to its normal product name from the 'availableProducts' list.
3.  **Credit Notes (Devoluciones sin Compra):** If a customer section ONLY contains returns/changes/devolutions and NO sales items, you MUST still create a sale object for that customer, but the 'items' array MUST be empty. This signals a credit note.
4.  **Date:** Extract the dispatch date if present at the top. Format it as YYYY-MM-DD. If the date in the text only contains day and month (e.g., '18/09'), you MUST assume it belongs to the current year (2025) and format it as '2025-09-18'.
5.  **Structure:** Group all items and changes for each unique customer into a single sale object. Do not create multiple sale objects for the same customer.
6.  **Feedback:** Use the 'analysisNotes' field to provide feedback on the process, especially if you have trouble matching a customer or product. This feedback MUST be in Spanish.

**REFERENCE LISTS:**
Known Customers:
{{#each availableCustomers}}
- {{{this}}}
{{/each}}

Known Products (including "No despachable" versions):
{{#each availableProducts}}
- {{{this}}}
{{/each}}

**INPUT TEXT:**
\`\`\`
{{{dispatchText}}}
\`\`\`

Provide the response strictly in the requested JSON format.`,
});

const processDispatchFlow = ai.defineFlow(
  {
    name: 'processDispatchFlow',
    inputSchema: ProcessDispatchInputSchema,
    outputSchema: ProcessDispatchOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to process dispatch. The AI model did not return a valid output.');
    }
    return output;
  }
);
