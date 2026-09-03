import { productsDataRaw } from '../../modules/products-data.js';

export const API_BASE = '/api';
export const WEIGHT_PER_CUBE = 680;

export const productsData = productsDataRaw.map(p => ({
    id: p.id,
    name: p.name,
    volume: p.volume
}));