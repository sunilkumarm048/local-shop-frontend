export type UserRole = 'customer' | 'shop' | 'delivery' | 'admin';

export interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  roles: UserRole[];
  avatar?: string;
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
