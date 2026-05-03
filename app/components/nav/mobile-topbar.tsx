import Image from "next/image";

type MobileTopbarProps = {
  notifications?: React.ReactNode;
};

export function MobileTopbar({ notifications }: MobileTopbarProps) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 md:hidden">
      <Image src="/logo.png" alt="Trendlet" width={110} height={32} priority />
      <div className="flex items-center">
        {notifications ?? <div className="h-9 w-9" aria-hidden />}
      </div>
    </header>
  );
}
