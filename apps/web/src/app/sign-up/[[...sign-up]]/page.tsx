import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border border-gray-100',
            headerTitle: 'text-gray-900',
            headerSubtitle: 'text-gray-500',
            formButtonPrimary: 'bg-brand-500 hover:bg-brand-600',
            footerActionLink: 'text-brand-600 hover:text-brand-700',
          },
        }}
      />
    </div>
  );
}
