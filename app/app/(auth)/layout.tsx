import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <BackgroundGradientAnimation
      containerClassName="min-h-screen"
      gradientBackgroundStart="rgb(7, 38, 74)"
      gradientBackgroundEnd="rgb(12, 68, 124)"
      firstColor="212, 175, 55"
      secondColor="184, 128, 26"
      thirdColor="255, 255, 255"
      fourthColor="245, 208, 99"
      fifthColor="12, 68, 124"
      pointerColor="255, 235, 180"
    >
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        {children}
      </main>
    </BackgroundGradientAnimation>
  );
}
