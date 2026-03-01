import { redirect } from 'next/navigation';

export default function RootPage() {
  // The public/index.html serves as the landing page
  // This redirect handles the case where Next.js routing intercepts /
  redirect('/index.html');
}
