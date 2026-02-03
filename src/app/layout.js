import './globals.css';

export const metadata = {
  title: 'WA Agent - Smart Value',
  description: 'Agent de gestion WhatsApp pour Smart Value',
  manifest: '/manifest.json',
  themeColor: '#10b981',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-gray-100 antialiased">{children}</body>
    </html>
  );
}
