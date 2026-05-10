import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <BackgroundGradientAnimation containerClassName="min-h-screen">
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        {children}
      </main>
    </BackgroundGradientAnimation>
  );
}
