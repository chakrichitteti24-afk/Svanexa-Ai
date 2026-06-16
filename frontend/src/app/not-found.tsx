import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground mb-4">Could not find requested resource</p>
      <Link href="/" className="text-pink-500 hover:underline">
        Return Home
      </Link>
    </div>
  );
}
