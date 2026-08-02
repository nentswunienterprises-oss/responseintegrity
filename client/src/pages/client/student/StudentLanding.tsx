import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/lib/config";
import { clearAllCache } from "@/lib/queryClient";

export default function StudentLanding() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sign Up State
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    parentCode: "",
  });

  // Sign In State
  const [signinData, setSigninData] = useState({
    email: "",
    password: "",
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (signupData.password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/student/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: signupData.email,
          password: signupData.password,
          firstName: signupData.firstName,
          lastName: signupData.lastName,
          parentCode: signupData.parentCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      toast({
        title: "Account Created!",
        description: "Welcome to Response Integrity Student Portal. Redirecting...",
      });

      // Clear any cached data from previous user before navigating
      clearAllCache();

      // Redirect to student dashboard
      setTimeout(() => {
        navigate("/client/student/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/api/student/signin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: signinData.email,
          password: signinData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to sign in");
      }

      toast({
        title: "Welcome Back!",
        description: "Signing you in...",
      });

      // Clear any cached data from previous user before navigating
      clearAllCache();

      // Redirect to student dashboard
      setTimeout(() => {
        navigate("/client/student/dashboard");
      }, 500);
    } catch (error: any) {
      console.error("Signin error:", error);
      toast({
        title: "Sign In Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Response Integrity
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Your training starts here
          </p>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">{mode === "signup" ? "Create Your Account" : "Welcome Back"}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {mode === "signup" 
                ? "Enter the code your parent gave you to get started" 
                : "Sign in to access your learning dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {mode === "signup" ? (
              <form onSubmit={handleSignup} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="firstName" className="text-xs sm:text-sm">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      className="text-sm"
                      value={signupData.firstName}
                      onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="lastName" className="text-xs sm:text-sm">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      className="text-sm"
                      value={signupData.lastName}
                      onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="text-sm"
                    placeholder="your.email@example.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="password" className="text-xs sm:text-sm">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    className="text-sm"
                    placeholder="At least 8 characters"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs sm:text-sm">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="text-sm"
                    placeholder="Re-enter your password"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="parentCode" className="text-xs sm:text-sm">Parent Code</Label>
                  <Input
                    id="parentCode"
                    type="text"
                    placeholder="Enter the 8-character code"
                    value={signupData.parentCode}
                    onChange={(e) => setSignupData({ ...signupData, parentCode: e.target.value.toUpperCase() })}
                    maxLength={8}
                    className="font-mono text-base sm:text-lg tracking-wider"
                    required
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Ask your parent for this code
                  </p>
                </div>

                <Button type="submit" className="w-full text-sm sm:text-base" disabled={isSubmitting}>
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSignin} className="space-y-3 sm:space-y-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="signin-email" className="text-xs sm:text-sm">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    className="text-sm"
                    placeholder="your.email@example.com"
                    value={signinData.email}
                    onChange={(e) => setSigninData({ ...signinData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label htmlFor="signin-password" className="text-xs sm:text-sm">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    className="text-sm"
                    placeholder="Enter your password"
                    value={signinData.password}
                    onChange={(e) => setSigninData({ ...signinData, password: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </Button>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Don't have an account? </span>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-primary hover:underline font-medium"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by Response Integrity (Pty) Ltd.
        </p>
      </div>
    </div>
  );
}
