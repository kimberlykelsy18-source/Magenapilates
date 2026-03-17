import { Product } from '../types';
import spineImg from 'figma:asset/921f947b1987e7c9ce1568d1fe0db68b6bab1ef6.png';
import barrelImg from 'figma:asset/471d1ab52f3a2d8d1bf12ba882b9598f0c5665c9.png';
import chairImg from 'figma:asset/3b04fd289d3e2d0fa742db6926de03e16d8ee3c7.png';
import reformerImg from 'figma:asset/4f4f36adcb55713c37d5a19b8781b67397eeab60.png';

export const initialProducts: Product[] = [
  {
    id: '1',
    name: 'Spine Corrector',
    description: 'Professional Pilates spine corrector with curved design for back strengthening and flexibility exercises.',
    imageUrl: spineImg,
    purchasePrice: 45000,
    rentalPrice: 2400,
    rentalDeposit: 2700,
    status: 'available',
  },
  {
    id: '2',
    name: 'Pilates Barrel',
    description: 'Versatile Pilates barrel for core strengthening, stretching, and advanced Pilates exercises.',
    imageUrl: barrelImg,
    purchasePrice: 74500,
    rentalPrice: 4600,
    rentalDeposit: 4900,
    status: 'available',
  },
  {
    id: '3',
    name: 'Wunda Chair',
    description: 'Compact and powerful Pilates chair for full-body workouts and strength training.',
    imageUrl: chairImg,
    status: 'coming-soon',
  },
  {
    id: '4',
    name: 'Reformer',
    description: 'Premium Pilates reformer for comprehensive full-body conditioning and rehabilitation.',
    imageUrl: reformerImg,
    status: 'coming-soon',
  },
];