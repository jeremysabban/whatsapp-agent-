import { Suspense } from 'react';
import WhatsAppAgent from '../components/WhatsAppAgent';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Chargement...</div>}>
      <WhatsAppAgent />
    </Suspense>
  );
}
