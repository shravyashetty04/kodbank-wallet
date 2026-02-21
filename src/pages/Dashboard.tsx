import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const CONFETTI_COLORS = [
  "hsl(45, 80%, 55%)",
  "hsl(220, 60%, 20%)",
  "hsl(0, 80%, 60%)",
  "hsl(120, 60%, 50%)",
  "hsl(280, 70%, 55%)",
  "hsl(180, 60%, 50%)",
  "hsl(30, 90%, 55%)",
];

const ConfettiPiece = ({ index }: { index: number }) => {
  const left = Math.random() * 100;
  const delay = Math.random() * 2;
  const size = Math.random() * 10 + 6;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const shape = index % 3 === 0 ? "rounded-full" : index % 3 === 1 ? "rounded-sm" : "";

  return (
    <div
      className={`absolute animate-confetti ${shape}`}
      style={{
        left: `${left}%`,
        top: "-20px",
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        animationDelay: `${delay}s`,
        animationDuration: `${2 + Math.random() * 2}s`,
      }}
    />
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const username = localStorage.getItem("kodbank_user");

  useEffect(() => {
    if (!localStorage.getItem("kodbank_token")) {
      navigate("/login");
    }
  }, [navigate]);

  const checkBalance = useCallback(async () => {
    setLoading(true);
    setBalance(null);
    setShowConfetti(false);

    try {
      const token = localStorage.getItem("kodbank_token");
      const { data, error } = await supabase.functions.invoke("check-balance", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setBalance(data.balance);
      setShowConfetti(true);

      setTimeout(() => setShowConfetti(false), 5000);
    } catch (err: any) {
      if (err.message?.includes("token") || err.message?.includes("expired")) {
        localStorage.removeItem("kodbank_token");
        localStorage.removeItem("kodbank_user");
        navigate("/login");
      }
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("kodbank_token");
    localStorage.removeItem("kodbank_user");
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen gradient-navy overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 60 }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold text-gold tracking-tight">KODBANK</h1>
        <div className="flex items-center gap-4">
          <span className="text-gold-light/70 text-sm">Welcome, {username}</span>
          <Button variant="outline" size="sm" onClick={logout} className="border-gold/30 text-gold hover:bg-gold/10">
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex items-center justify-center px-4" style={{ minHeight: "calc(100vh - 72px)" }}>
        <Card className="w-full max-w-lg border-none shadow-bank bg-card/95 backdrop-blur text-center">
          <CardHeader>
            <CardTitle className="text-3xl">Your Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              onClick={checkBalance}
              disabled={loading}
              className="w-full text-lg py-6 bg-primary text-primary-foreground hover:bg-navy-light transition-all"
              size="lg"
            >
              {loading ? "Checking..." : "💰 Check Balance"}
            </Button>

            {balance !== null && (
              <div className="animate-pop-in">
                <div className="rounded-xl p-8 gradient-gold shadow-gold">
                  <p className="text-navy-dark text-sm font-medium uppercase tracking-widest mb-2">Your Balance Is</p>
                  <p className="text-navy-dark text-5xl font-bold">₹ {Number(balance).toLocaleString("en-IN")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
