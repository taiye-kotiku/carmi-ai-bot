import { LemonSqueezyCheckout, LemonSqueezyProduct, LemonSqueezyVariant, LemonSqueezyOrder, LemonSqueezySubscription } from './types';

const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';

interface LemonSqueezyResponse<T> {
    data: T;
    links?: {
        self: string;
    };
}

export class LemonSqueezyClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<LemonSqueezyResponse<T>> {
        const url = `${LEMONSQUEEZY_API_URL}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(
                `Lemon Squeezy API error: ${response.status} - ${JSON.stringify(error)}`
            );
        }

        return response.json();
    }

    // Get current user
    async getUser() {
        return this.request('/users/me');
    }

    // Get stores
    async getStores() {
        return this.request('/stores');
    }

    // Get products
    async getProducts(storeId?: string) {
        const params = storeId ? `?filter[store_id]=${storeId}` : '';
        return this.request(`/products${params}`);
    }

    // Get variants for a product
    async getVariants(productId: string) {
        return this.request(`/products/${productId}/variants`);
    }

    // Create a checkout
    async createCheckout(data: {
        storeId: string;
        variantId: string;
        customPrice?: number;
        checkoutData?: {
            email?: string;
            name?: string;
            custom?: Record<string, any>;
        };
    }): Promise<LemonSqueezyResponse<LemonSqueezyCheckout>> {
        return this.request<LemonSqueezyCheckout>('/checkouts', {
            method: 'POST',
            body: JSON.stringify({
                data: {
                    type: 'checkouts',
                    attributes: {
                        custom_price: data.customPrice,
                        checkout_data: data.checkoutData,
                    },
                    relationships: {
                        store: {
                            data: {
                                type: 'stores',
                                id: data.storeId,
                            },
                        },
                        variant: {
                            data: {
                                type: 'variants',
                                id: data.variantId,
                            },
                        },
                    },
                },
            }),
        });
    }

    // Get orders
    async getOrders(params?: {
        storeId?: string;
        userEmail?: string;
        page?: number;
        perPage?: number;
    }) {
        const queryParams = new URLSearchParams();

        if (params?.storeId) {
            queryParams.append('filter[store_id]', params.storeId);
        }
        if (params?.userEmail) {
            queryParams.append('filter[user_email]', params.userEmail);
        }
        if (params?.page) {
            queryParams.append('page[number]', params.page.toString());
        }
        if (params?.perPage) {
            queryParams.append('page[size]', params.perPage.toString());
        }

        const query = queryParams.toString();
        return this.request(`/orders${query ? `?${query}` : ''}`);
    }

    // Get subscriptions
    async getSubscriptions(params?: {
        storeId?: string;
        userEmail?: string;
        status?: string;
        page?: number;
        perPage?: number;
    }) {
        const queryParams = new URLSearchParams();

        if (params?.storeId) {
            queryParams.append('filter[store_id]', params.storeId);
        }
        if (params?.userEmail) {
            queryParams.append('filter[user_email]', params.userEmail);
        }
        if (params?.status) {
            queryParams.append('filter[status]', params.status);
        }
        if (params?.page) {
            queryParams.append('page[number]', params.page.toString());
        }
        if (params?.perPage) {
            queryParams.append('page[size]', params.perPage.toString());
        }

        const query = queryParams.toString();
        return this.request(`/subscriptions${query ? `?${query}` : ''}`);
    }
}

// Export singleton instance
export const lemonSqueezy = new LemonSqueezyClient(
    process.env.LEMONSQUEEZY_API_KEY || ''
);