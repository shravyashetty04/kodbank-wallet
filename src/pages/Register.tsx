import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    uid: "",
    username: "",
    password: "",
    email: "",
    phone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("register", {
        body: { ...form, role: "Customer" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: "Registration Successful!",
        description: "Please login with your credentials.",
      });
      navigate("/login");
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-navy p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gold tracking-tight">KODBANK</h1>
          <p className="mt-2 text-gold-light/70 text-sm">Secure. Reliable. Yours.</p>
        </div>

        <Card className="border-none shadow-bank bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>Fill in your details to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uid">User ID</Label>
                <Input id="uid" name="uid" placeholder="Enter unique ID" value={form.uid} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" placeholder="Choose a username" value={form.username} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="your@email.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" placeholder="Phone number" value={form.phone} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="Create a password" value={form.password} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value="Customer" disabled className="bg-muted" />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-navy-light" disabled={loading}>
                {loading ? "Creating Account..." : "Register"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-accent hover:underline font-medium">Login</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
