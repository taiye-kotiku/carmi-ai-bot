// src/lib/cardcom/types.ts

// ─── LowProfile Create Request ───
export interface CardcomCreateRequest {
    TerminalNumber: number;
    ApiName: string;
    Operation?: string;               // "ChargeOnly" (default)
    ReturnValue?: string;             // Your order ID, max 250 chars
    Amount: number;                   // e.g. 10.5
    SuccessRedirectUrl: string;       // max 500 chars
    FailedRedirectUrl: string;        // max 500 chars
    CancelRedirectUrl?: string;       // max 500 chars
    WebHookUrl: string;               // max 500 chars
    ProductName?: string;             // max 250 chars
    Language?: string;                // "he","en","ru","sp"
    ISOCoinId?: number;               // 1=ILS, 2=USD
    Document?: {
        To?: string;
        Email?: string;
        Products?: Array<{
            Description?: string;
            Quantity?: number;
            UnitCost?: number;
        }>;
    };
}

// ─── LowProfile Create Response ───
export interface CardcomCreateResponse {
    ResponseCode: number;             // 0 = success
    Description: string;
    LowProfileId: string;            // GUID - needed for GetLpResult
    Url: string;                     // Payment page URL
    UrlToPayPal?: string;
    UrlToBit?: string;
}

// ─── GetLpResult Request ───
export interface CardcomGetResultRequest {
    TerminalNumber: number;
    ApiName: string;
    LowProfileId: string;            // GUID from create response
}

// ─── Webhook Payload (POST to WebHookUrl) ───
export interface CardcomWebhookPayload {
    ResponseCode: number;             // 0 = success
    Description: string;
    TerminalNumber: number;
    LowProfileId: string;
    TranzactionId: number;
    ReturnValue: string;              // Your order ID
    Operation: string;
    UIValues?: {
        CardOwnerEmail?: string;
        CardOwnerName?: string;
        CardOwnerPhone?: string;
        CardOwnerIdentityNumber?: string;
        NumOfPayments?: number;
        CardYear?: number;
        CardMonth?: number;
        CustomFields?: string[];
        IsAbroadCard?: boolean;
    };
    DocumentInfo?: {
        ResponseCode: number;
        Description: string;
        DocumentType: string;
        DocumentNumber: number;
        AccountId: number;
        ForeignAccountNumber?: string;
        SiteUniqueId?: string;
        DocumentUrl?: string;
    };
    TokenInfo?: {
        Token?: string;
        TokenExDate?: string;
        CardYear?: number;
        CardMonth?: number;
        TokenApprovalNumber?: string;
        CardOwnerIdentityNumber?: string;
    };
    TranzactionInfo?: {
        ResponseCode: number;
        Description: string;
        TranzactionId: number;
        TerminalNumber: number;
        Amount: number;
        CoinId: number;
        Last4CardDigitsString?: string;
        CardMonth?: number;
        CardYear?: number;
        ApprovalNumber?: string;
        NumberOfPayments?: number;
        CardInfo?: string;
        CardOwnerName?: string;
        CardOwnerPhone?: string;
        CardOwnerEmail?: string;
        Token?: string;
        CardName?: string;
        Uid?: string;
        DocumentNumber?: number;
        DocumentType?: string;
        IsRefund?: boolean;
        DocumentUrl?: string;
        CustomFields?: string[];
        IsAbroadCard?: boolean;
    };
}

// ─── GetLpResult Response (same structure as webhook) ───
export type CardcomGetResultResponse = CardcomWebhookPayload;

// ─── Credit Plans ───
export interface CreditPlan {
    id: string;
    name: string;
    nameHe: string;
    credits: number;
    price: number;
    pricePerCredit: number;
    popular?: boolean;
    savings?: string;
    features: string[];
}