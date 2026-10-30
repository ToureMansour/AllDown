import Image from "next/image";
import Link from "next/link";

export function Logo({
  className = "h-12",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      className="inline-flex rounded-lg"
      aria-label="AllDown, retour à l'accueil"
    >
      <Image
        src="/logo.png"
        alt="AllDown"
        width={815}
        height={689}
        priority={priority}
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
