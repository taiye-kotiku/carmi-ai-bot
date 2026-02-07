export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    name: string | null;
                    avatar_url: string | null;
                    locale: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    name?: string | null;
                    avatar_url?: string | null;
                    locale?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string;
                    name?: string | null;
                    avatar_url?: string | null;
                    locale?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            credits: {
                Row: {
                    id: number;
                    user_id: string;
                    image_credits: number;
                    reel_credits: number;
                    video_credits: number;
                    carousel_credits: number;
                    updated_at: string;
                };
                Insert: {
                    user_id: string;
                    image_credits?: number;
                    reel_credits?: number;
                    video_credits?: number;
                    carousel_credits?: number;
                };
                Update: {
                    image_credits?: number;
                    reel_credits?: number;
                    video_credits?: number;
                    carousel_credits?: number;
                    updated_at?: string;
                };
                Relationships: [];
            };
            credit_transactions: {
                Row: {
                    id: number;
                    user_id: string;
                    credit_type: string;
                    amount: number;
                    balance_after: number;
                    reason: string;
                    related_id: string | null;
                    created_at: string;
                };
                Insert: {
                    user_id: string;
                    credit_type: string;
                    amount: number;
                    balance_after: number;
                    reason: string;
                    related_id?: string | null;
                };
                Update: never;
                Relationships: [];
            };
            brands: {
                Row: {
                    id: number;
                    user_id: string;
                    name: string;
                    tagline: string | null;
                    primary_color: string | null;
                    style: string | null;
                    logo_url: string | null;
                    logo_position: string;
                    logo_size: number;
                    logo_opacity: number;
                    is_enabled: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    user_id: string;
                    name: string;
                    tagline?: string | null;
                    primary_color?: string | null;
                    style?: string | null;
                    logo_url?: string | null;
                    logo_position?: string;
                    logo_size?: number;
                    logo_opacity?: number;
                    is_enabled?: boolean;
                };
                Update: {
                    name?: string;
                    tagline?: string | null;
                    primary_color?: string | null;
                    style?: string | null;
                    logo_url?: string | null;
                    logo_position?: string;
                    logo_size?: number;
                    logo_opacity?: number;
                    is_enabled?: boolean;
                    updated_at?: string;
                };
                Relationships: [];
            };
            generations: {
                Row: {
                    id: string;
                    user_id: string;
                    type: string;
                    feature: string;
                    prompt: string | null;
                    source_url: string | null;
                    result_urls: string[];
                    thumbnail_url: string | null;
                    width: number | null;
                    height: number | null;
                    duration: number | null;
                    status: string;
                    job_id: string | null;
                    error_message: string | null;
                    processing_time_ms: number | null;
                    has_branding: boolean;
                    created_at: string;
                    completed_at: string | null;
                };
                Insert: {
                    id: string;
                    user_id: string;
                    type: string;
                    feature: string;
                    prompt?: string | null;
                    source_url?: string | null;
                    result_urls?: string[];
                    thumbnail_url?: string | null;
                    width?: number | null;
                    height?: number | null;
                    duration?: number | null;
                    status?: string;
                    job_id?: string | null;
                    error_message?: string | null;
                    processing_time_ms?: number | null;
                    has_branding?: boolean;
                };
                Update: {
                    result_urls?: string[];
                    thumbnail_url?: string | null;
                    status?: string;
                    error_message?: string | null;
                    processing_time_ms?: number | null;
                    completed_at?: string | null;
                };
                Relationships: [];
            };
            jobs: {
                Row: {
                    id: string;
                    user_id: string;
                    type: string;
                    status: string;
                    progress: number;
                    result: Json | null;
                    error: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    user_id: string;
                    type: string;
                    status?: string;
                    progress?: number;
                    result?: Json | null;
                    error?: string | null;
                };
                Update: {
                    status?: string;
                    progress?: number;
                    result?: Json | null;
                    error?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            subscriptions: {
                Row: {
                    id: string;
                    user_id: string;
                    payplus_subscription_id: string | null;
                    plan_name: string;
                    status: string;
                    current_period_start: string | null;
                    current_period_end: string | null;
                    cancel_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    user_id: string;
                    payplus_subscription_id?: string | null;
                    plan_name: string;
                    status: string;
                    current_period_start?: string | null;
                    current_period_end?: string | null;
                };
                Update: {
                    payplus_subscription_id?: string | null;
                    status?: string;
                    current_period_start?: string | null;
                    current_period_end?: string | null;
                    cancel_at?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            characters: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    description: string | null;
                    thumbnail_url: string | null;
                    status: 'pending' | 'training' | 'ready' | 'failed';
                    lora_url: string | null;
                    job_id: string | null;
                    training_started_at: string | null;
                    trained_at: string | null;
                    error_message: string | null;
                    settings: {
                        model?: string;
                        ip_adapter_scale?: number;
                        trigger_word?: string;
                        reference_images?: string[];
                    };
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    description?: string | null;
                    thumbnail_url?: string | null;
                    status?: 'pending' | 'training' | 'ready' | 'failed';
                    lora_url?: string | null;
                    job_id?: string | null;
                    training_started_at?: string | null;
                    trained_at?: string | null;
                    error_message?: string | null;
                    settings?: {
                        model?: string;
                        ip_adapter_scale?: number;
                        trigger_word?: string;
                        reference_images?: string[];
                    };
                };
                Update: {
                    name?: string;
                    description?: string | null;
                    thumbnail_url?: string | null;
                    status?: 'pending' | 'training' | 'ready' | 'failed';
                    lora_url?: string | null;
                    job_id?: string | null;
                    training_started_at?: string | null;
                    trained_at?: string | null;
                    error_message?: string | null;
                    settings?: {
                        model?: string;
                        ip_adapter_scale?: number;
                        trigger_word?: string;
                        reference_images?: string[];
                    };
                    updated_at?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Credits = Database["public"]["Tables"]["credits"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type Generation = Database["public"]["Tables"]["generations"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type CreditTransaction = Database["public"]["Tables"]["credit_transactions"]["Row"];
export type Character = Database["public"]["Tables"]["characters"]["Row"];