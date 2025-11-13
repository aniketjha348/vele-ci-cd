// Razorpay Checkout utility
declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Load Razorpay script
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
};

// Open Razorpay checkout
export const openRazorpayCheckout = (options: RazorpayOptions): void => {
  console.log('Opening Razorpay checkout with options:', {
    key: options.key,
    amount: options.amount,
    order_id: options.order_id,
  });

  if (!window.Razorpay) {
    console.error('Razorpay script not loaded');
    throw new Error('Razorpay script not loaded. Please refresh the page.');
  }

  const razorpayOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.order_id,
    handler: (response: RazorpayResponse) => {
      console.log('Razorpay payment successful:', response);
      options.handler(response);
    },
    prefill: options.prefill || {},
    theme: options.theme || {
      color: '#8B5CF6', // Cyberpunk purple
    },
    modal: {
      ondismiss: () => {
        console.log('Payment modal dismissed');
        if (options.modal?.ondismiss) {
          options.modal.ondismiss();
        }
      },
    },
  };

  try {
    const razorpay = new window.Razorpay(razorpayOptions);
    console.log('Razorpay instance created, opening modal...');
    razorpay.on('payment.failed', (error: any) => {
      console.error('Payment failed:', error);
    });
    razorpay.open();
  } catch (error) {
    console.error('Error opening Razorpay:', error);
    throw error;
  }
};

