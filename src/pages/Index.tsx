import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gradient-navy p-4 text-center">
      <div className="animate-pop-in">
        <h1 className="text-6xl font-bold text-gold tracking-tight mb-2">KODBANK</h1>
        <div className="h-1 w-24 mx-auto gradient-gold rounded-full mb-6" />
        <p className="text-gold-light/70 text-lg mb-10 max-w-md">
          Your trusted digital banking partner. Secure, simple, and built for you.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-gold-dark px-8 text-base">
            <Link to="/register">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-gold/40 text-gold hover:bg-gold/10 px-8 text-base">
            <Link to="/login">Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
