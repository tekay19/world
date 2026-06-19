import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Gören Göz — Gelecek Tahmin & Analiz',
  description:
    'Gören Göz: dönen 3D Dünya üzerinde seçilen ülkenin gündemini kaynaklı, kalibre, ileri görüşlü analiz ve sohbetle gör.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
