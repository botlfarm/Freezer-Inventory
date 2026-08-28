import React from 'react';
import { 
  // Storage
  Box, 
  Archive, 
  Layers, 
  Package, 
  Grid, 
  Folder, 
  Warehouse, 
  Refrigerator, 
  ShoppingBag,
  Backpack,
  Luggage,
  Wallet,
  Boxes,
  Database,
  Container,
  ShoppingCart,
  HardDrive,
  Inbox,
  
  // Meats & Fish
  Beef, 
  Fish, 
  Egg,
  Flame,
  
  // Fruits & Foods
  Apple, 
  Soup, 
  Cookie, 
  Croissant, 
  Pizza, 
  Salad,
  Cake,
  IceCream,
  Popcorn,
  Utensils,
  ChevronRight,
  
  // Drinks
  Milk, 
  Coffee,
  GlassWater,
  CupSoda,
  Wine,
  
  // Tags & Labels
  Tag, 
  Tags, 
  Bookmark, 
  QrCode,
  Briefcase, 
  Gift,
  Key,
  
  // Indicators
  Snowflake, 
  Thermometer, 
  ThermometerSnowflake, 
  Clock, 
  Scale, 
  Heart, 
  Star, 
  Sparkles
} from 'lucide-react';

export interface IconMeta {
  id: string;
  label: string;
  component: React.FC<{className?: string}>;
  category: 'storage' | 'food' | 'drink' | 'labels' | 'indicators';
}

export const CONTAINER_ICONS: IconMeta[] = [
  // Storage
  { id: 'box', label: 'Box / Cardboard', component: Box, category: 'storage' },
  { id: 'bin', label: 'Bin / Chest', component: Archive, category: 'storage' },
  { id: 'pillowcase', label: 'Bag / Pillowcase', component: Layers, category: 'storage' },
  { id: 'generic', label: 'Generic Package', component: Package, category: 'storage' },
  { id: 'grid', label: 'Tray / Grid', component: Grid, category: 'storage' },
  { id: 'warehouse', label: 'Warehouse / Rack', component: Warehouse, category: 'storage' },
  { id: 'refrigerator', label: 'Fridge', component: Refrigerator, category: 'storage' },
  { id: 'shopping-bag', label: 'Shopping Bag', component: ShoppingBag, category: 'storage' },
  { id: 'backpack', label: 'Backpack / Heavy Bag', component: Backpack, category: 'storage' },
  { id: 'luggage', label: 'Luggage / Travel Bag', component: Luggage, category: 'storage' },
  { id: 'pouch', label: 'Small Pouch / Zip Bag', component: Wallet, category: 'storage' },
  { id: 'boxes', label: 'Multi-Boxes', component: Boxes, category: 'storage' },
  { id: 'database', label: 'Database / Stack', component: Database, category: 'storage' },
  { id: 'container', label: 'Shipping Container', component: Container, category: 'storage' },
  { id: 'shopping-cart', label: 'Shopping Cart', component: ShoppingCart, category: 'storage' },
  { id: 'hard-drive', label: 'Metal Case', component: HardDrive, category: 'storage' },
  { id: 'tray', label: 'Shallow Tray', component: Inbox, category: 'storage' },

  // Food
  { id: 'beef', label: 'Beef / Steak / Pork', component: Beef, category: 'food' },
  { id: 'fish', label: 'Fish / Seafood', component: Fish, category: 'food' },
  { id: 'egg', label: 'Egg / Poultry', component: Egg, category: 'food' },
  { id: 'icecream', label: 'Frozen Treats', component: IceCream, category: 'food' },
  { id: 'apple', label: 'Fruit / Veggies', component: Apple, category: 'food' },
  { id: 'soup', label: 'Soup / Bowl', component: Soup, category: 'food' },
  { id: 'cookie', label: 'Cookies / Bakery', component: Cookie, category: 'food' },
  { id: 'croissant', label: 'Pastry / Bread', component: Croissant, category: 'food' },
  { id: 'pizza', label: 'Pizza', component: Pizza, category: 'food' },
  { id: 'salad', label: 'Salad / Greenery', component: Salad, category: 'food' },
  { id: 'cake', label: 'Cake / Dessert', component: Cake, category: 'food' },
  { id: 'popcorn', label: 'Snacks', component: Popcorn, category: 'food' },
  { id: 'utensils', label: 'Meals / Dining', component: Utensils, category: 'food' },

  // Drink
  { id: 'milk', label: 'Milk / Dairy', component: Milk, category: 'drink' },
  { id: 'coffee', label: 'Hot Drinks', component: Coffee, category: 'drink' },
  { id: 'glass-water', label: 'Water / Juice', component: GlassWater, category: 'drink' },
  { id: 'cup-soda', label: 'Soda / Fast Food', component: CupSoda, category: 'drink' },
  { id: 'wine', label: 'Alcohol / Bottles', component: Wine, category: 'drink' },

  // Labels
  { id: 'folder', label: 'Folder / Organization', component: Folder, category: 'labels' },
  { id: 'tag', label: 'Single Tag', component: Tag, category: 'labels' },
  { id: 'tags', label: 'Multiple Tags', component: Tags, category: 'labels' },
  { id: 'bookmark', label: 'Bookmark', component: Bookmark, category: 'labels' },
  { id: 'label', label: 'Sticker Label', component: QrCode, category: 'labels' },
  { id: 'briefcase', label: 'Business / Vault', component: Briefcase, category: 'labels' },
  { id: 'gift', label: 'Gift / Box', component: Gift, category: 'labels' },
  { id: 'key', label: 'Secrets / Key', component: Key, category: 'labels' },

  // Indicators
  { id: 'snowflake', label: 'Snowflake / Cold', component: Snowflake, category: 'indicators' },
  { id: 'thermometer-snow', label: 'Deep Freeze Meter', component: ThermometerSnowflake, category: 'indicators' },
  { id: 'flame', label: 'Spicy / Heat', component: Flame, category: 'indicators' },
  { id: 'thermometer', label: 'Temperature', component: Thermometer, category: 'indicators' },
  { id: 'clock', label: 'Alert / Timer', component: Clock, category: 'indicators' },
  { id: 'scale', label: 'Scale / Weight', component: Scale, category: 'indicators' },
  { id: 'heart', label: 'Favorites / Premium', component: Heart, category: 'indicators' },
  { id: 'star', label: 'Star / Important', component: Star, category: 'indicators' },
  { id: 'sparkles', label: 'Sparkles / Fresh', component: Sparkles, category: 'indicators' },
];

export const getContainerIcon = (_iconName?: string): React.FC<{className?: string}> => {
  return Box;
};
