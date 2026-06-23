export type UserRole = 'customer' | 'shop' | 'delivery' | 'admin';

export interface UserAddress {
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  roles: UserRole[];
  avatar?: string;
  addresses?: UserAddress[];
}

export interface CartItem {
  productId: string;
  shopId: string;
  name: string;
  price: number;
  qty: number;
  weight?: string;
  image?: string;
}
