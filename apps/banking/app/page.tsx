import Link from "next/link";
import { Wallet, ArrowRight, Shield, CreditCard, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl mb-6">
            <Wallet className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Dummy Bank
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Secure, Fast, and Reliable Internet Banking Experience
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="bg-white/20 rounded-xl p-3 w-fit mb-4">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Secure Banking</h3>
            <p className="text-blue-100 text-sm">
              Bank-level encryption and security protocols to keep your money safe
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="bg-white/20 rounded-xl p-3 w-fit mb-4">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Easy Transfers</h3>
            <p className="text-blue-100 text-sm">
              Send money instantly via UPI, IMPS, or NEFT with just a few clicks
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="bg-white/20 rounded-xl p-3 w-fit mb-4">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Track Everything</h3>
            <p className="text-blue-100 text-sm">
              View detailed statements and track all your transactions in one place
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Get Started
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Access your account or create a new one
            </p>
            
            <div className="space-y-4">
              <Link
                href="/login"
                className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg"
              >
                <span>Login to Internet Banking</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              
              <Link
                href="/register"
                className="block w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-4 px-6 rounded-xl transition-all text-center"
              >
                Create New Account
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
