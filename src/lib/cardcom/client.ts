// src/lib/cardcom/client.ts

import type {
    CardcomCreateRequest,
    CardcomCreateResponse,
    CardcomGetResultResponse,
} from "./types";

const CARDCOM_API_BASE = "https://secure.cardcom.solutions/api/v11";

function getCredentials() {
    const terminalNumber = process.env.CARDCOM_TERMINAL;
    const apiName = process.env.CARDCOM_API_NAME;

    if (!terminalNumber || !apiName) {
        throw new Error(
            "Missing CARDCOM_TERMINAL or CARDCOM_API_NAME environment variables"
        );
    }

    return {
        terminalNumber: parseInt(terminalNumber, 10),
        apiName,
    };
}

/**
 * Create a LowProfile payment page.
 * Returns a URL where the user enters card details securely.
 * Docs: POST /api/v11/LowProfile/Create
 */
export async function createLowProfile(params: {
    amount: number;
    productName: string;
    successUrl: string;
    failedUrl: string;
    cancelUrl?: string;
    webhookUrl: string;
    returnValue: string; // your order ID
    customerEmail?: string;
    customerName?: string;
}): Promise<CardcomCreateResponse> {
    const { terminalNumber, apiName } = getCredentials();

    const body: CardcomCreateRequest = {
        TerminalNumber: terminalNumber,
        ApiName: apiName,
        Operation: "ChargeOnly",
        ReturnValue: params.returnValue,
        Amount: params.amount,
        SuccessRedirectUrl: params.successUrl,
        FailedRedirectUrl: params.failedUrl,
        CancelRedirectUrl: params.cancelUrl || params.failedUrl,
        WebHookUrl: params.webhookUrl,
        ProductName: params.productName,
        Language: "he",
        ISOCoinId: 1, // ILS
        // Optionally create an invoice document
        Document: params.customerEmail
            ? {
                To: params.customerName || "לקוח",
                Email: params.customerEmail,
                Products: [
                    {
                        Description: params.productName,
                        Quantity: 1,
                        UnitCost: params.amount,
                    },
                ],
            }
            : undefined,
    };

    console.log("[Cardcom] Creating LowProfile:", {
        amount: params.amount,
        returnValue: params.returnValue,
        webhookUrl: params.webhookUrl,
    });

    const response = await fetch(`${CARDCOM_API_BASE}/LowProfile/Create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const data: CardcomCreateResponse = await response.json();

    if (data.ResponseCode !== 0) {
        console.error("[Cardcom] LowProfile creation failed:", data);
        throw new Error(
            `Cardcom error (${data.ResponseCode}): ${data.Description}`
        );
    }

    console.log("[Cardcom] LowProfile created:", {
        lowProfileId: data.LowProfileId,
        url: data.Url,
    });

    return data;
}

/**
 * Get the result of a LowProfile transaction.
 * Use this to verify a payment after the webhook or redirect.
 * Docs: POST /api/v11/LowProfile/GetLpResult
 */
export async function getLowProfileResult(
    lowProfileId: string
): Promise<CardcomGetResultResponse> {
    const { terminalNumber, apiName } = getCredentials();

    const response = await fetch(`${CARDCOM_API_BASE}/LowProfile/GetLpResult`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            TerminalNumber: terminalNumber,
            ApiName: apiName,
            LowProfileId: lowProfileId,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error("[Cardcom] GetLpResult HTTP error:", response.status, text);
        throw new Error(`Cardcom API error: ${response.status}`);
    }

    const data: CardcomGetResultResponse = await response.json();

    console.log("[Cardcom] GetLpResult:", {
        responseCode: data.ResponseCode,
        tranzactionId: data.TranzactionId,
        amount: data.TranzactionInfo?.Amount,
    });

    return data;
}