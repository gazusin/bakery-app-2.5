
'use server';
/**
 * @fileOverview An AI flow to process payment confirmation images and extract structured data.
 *
 * - processPayment - A function that handles the payment processing.
 * - ProcessPaymentInput - The input type for the processPayment function.
 * - ProcessPaymentOutput - The return type for the processPayment function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProcessPaymentInputSchema = z.object({
  paymentImageUri: z
    .string()
    .describe(
      "A photo or screenshot of a payment confirmation (like a Venezuelan Pago Móvil), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type ProcessPaymentInput = z.infer<typeof ProcessPaymentInputSchema>;

const ProcessPaymentOutputSchema = z.object({
  referenceNumber: z.string().optional().describe('The payment reference number. IMPORTANT: Extract ONLY THE LAST 6 DIGITS of the reference number. For example, if it says "Ref. 000123456", you must return "123456". If it says "CI: 12345678 Ref: 012345", you must return "012345". Ignore any other characters.'),
  amount: z.number().optional().describe('The total amount of the payment in VES (Bolívares). It is usually labeled as MONTO or TOTAL. It is a number, so extract only digits and the decimal separator.'),
  date: z.string().optional().describe('The date of the payment. Try to format it as YYYY-MM-DD. If the format in the image is DD-MM-YYYY or DD/MM/YYYY, please convert it to YYYY-MM-DD before returning.'),
  analysisNotes: z.string().optional().describe('Brief notes about the analysis process, such as difficulties encountered extracting the data. If everything is clear, say "Datos extraídos exitosamente de la imagen."')
});
export type ProcessPaymentOutput = z.infer<typeof ProcessPaymentOutputSchema>;

export async function processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentOutput> {
  return processPaymentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processPaymentPrompt',
  input: { schema: ProcessPaymentInputSchema },
  output: { schema: ProcessPaymentOutputSchema },
  prompt: `You are an expert data entry assistant. Your task is to analyze the provided payment confirmation image (likely a Venezuelan "Pago Móvil") and extract key information. The currency is always VES (Bolívares).

**CRITICAL INSTRUCTIONS:**
1.  **Reference Number:** You MUST extract ONLY THE LAST 6 DIGITS of the payment reference number. It is often labeled as "Ref.", "Referencia", "Nro. de Referencia", etc. For example, if the reference is "0000123456", you must return "123456". If the reference is "Ref: 456789", you must return "456789". Ignore any other characters. This is the most critical instruction.
2.  **Amount:** Extract the payment amount, usually labeled "Monto" or "Total". It will be a number in VES. Make sure to parse it as a number, including decimals. For example "Bs. 1.875,00" should become \`1875.00\`.
3.  **Date:** Extract the payment date. You MUST convert it to YYYY-MM-DD format. If the date in the image is "19/07/2025" or "19-07-2025", you MUST return "2025-07-19".
4.  **Analysis Notes:** Use this field to report any issues or to confirm success.

**INPUT IMAGE:**
{{media url=paymentImageUri}}

Provide the response strictly in the requested JSON format. If you cannot find a piece of information, omit the field.`,
});

const processPaymentFlow = ai.defineFlow(
  {
    name: 'processPaymentFlow',
    inputSchema: ProcessPaymentInputSchema,
    outputSchema: ProcessPaymentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to process payment. The AI model did not return a valid output.');
    }
    return output;
  }
);
