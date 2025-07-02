import { Link } from 'react-router-dom';
import { Calendar, Target, Trophy, Timer, Users, Star, Gem, Building, Check, ArrowRight } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../types';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Goal Calendly</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#pricing" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Pricing
                </a>
                <a href="#about" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  About
                </a>
                <Link 
                  to="/login" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Transform Your</span>{' '}
                  <span className="block text-blue-600 xl:inline">Goals Into Reality</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Experience the wonderful journey of achieving your goals with Goal Calendly. 
                  Track progress, earn trophies, and build lasting habits with our intuitive calendar-based approach.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link
                      to="/signup"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors"
                    >
                      Start Your Journey
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Link
                      to="/login"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 md:py-4 md:text-lg md:px-10 transition-colors"
                    >
                      Sign In
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full bg-gradient-to-r from-blue-400 to-purple-500 sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center">
            <div className="text-white text-center">
              <Calendar className="h-24 w-24 mx-auto mb-4 opacity-80" />
              <h3 className="text-2xl font-bold mb-2">Your Goals Await</h3>
              <p className="text-lg opacity-90">Start tracking today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to succeed
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Goal Calendly provides all the tools you need to track, manage, and achieve your goals with ease.
            </p>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <Target className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Goal Tracking</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Set and track your goals with our intuitive interface. Monitor progress and stay motivated.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <Calendar className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Calendar Integration</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Visualize your progress with beautiful calendar views and track daily practice sessions.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <Trophy className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Achievement System</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Earn trophies and celebrate milestones as you progress towards your goals.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <Timer className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-gray-900">Time Tracking</p>
                <p className="mt-2 ml-16 text-base text-gray-500">
                  Built-in timer to track practice sessions and monitor time spent on each goal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="sm:text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Choose Your Plan
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Start free and upgrade as you grow. All plans include our core features.
            </p>
          </div>

          <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-4">
            {Object.entries(SUBSCRIPTION_PLANS).map(([planKey, plan]) => {
              const planType = planKey as keyof typeof SUBSCRIPTION_PLANS;
              const isPopular = planType === 'pro';
              
              const getPlanIcon = () => {
                switch (planType) {
                  case 'free': return <Users className="w-8 h-8" />;
                  case 'pro': return <Star className="w-8 h-8" />;
                  case 'platinum': return <Gem className="w-8 h-8" />;
                  case 'enterprise': return <Building className="w-8 h-8" />;
                }
              };

              const getPlanPrice = () => {
                const plan = SUBSCRIPTION_PLANS[planType];
                if (planType === 'free') return 'Free';
                if (planType === 'enterprise') return 'Contact us';
                return `$${plan.price}/mo`;
              };

              return (
                <div key={planType} className={`border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200 ${isPopular ? 'border-blue-500 relative' : ''}`}>
                  {isPopular && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <span className="inline-flex px-4 py-1 rounded-full text-sm font-semibold tracking-wide uppercase bg-blue-500 text-white">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center justify-center mb-4 text-blue-600">
                      {getPlanIcon()}
                    </div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 text-center">
                      {planType.charAt(0).toUpperCase() + planType.slice(1)}
                    </h3>
                    <p className="mt-4 text-sm text-gray-500 text-center">
                      Perfect for {planType === 'free' ? 'getting started' : 
                                 planType === 'pro' ? 'serious goal setters' :
                                 planType === 'platinum' ? 'power users' : 'organizations'}
                    </p>
                    <p className="mt-8">
                      <span className="text-4xl font-extrabold text-gray-900 text-center block">
                        {getPlanPrice()}
                      </span>
                    </p>
                    <Link
                      to="/signup"
                      className={`mt-8 block w-full border border-gray-800 rounded-md py-2 text-sm font-semibold text-center transition-colors ${
                        isPopular 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' 
                          : 'text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {planType === 'enterprise' ? 'Contact Sales' : 'Get Started'}
                    </Link>
                  </div>
                  <div className="pt-6 pb-8 px-6">
                    <h4 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
                      What's included
                    </h4>
                    <ul className="mt-6 space-y-4">
                      <li className="flex space-x-3">
                        <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                        <span className="text-sm text-gray-500">
                          Up to {plan.maxGoals === -1 ? 'unlimited' : plan.maxGoals} goals
                        </span>
                      </li>
                      <li className="flex space-x-3">
                        <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                        <span className="text-sm text-gray-500">Calendar tracking</span>
                      </li>
                      <li className="flex space-x-3">
                        <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                        <span className="text-sm text-gray-500">Achievement system</span>
                      </li>
                      <li className="flex space-x-3">
                        <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                        <span className="text-sm text-gray-500">Time tracking</span>
                      </li>
                      {planType !== 'free' && (
                        <li className="flex space-x-3">
                          <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                          <span className="text-sm text-gray-500">Priority support</span>
                        </li>
                      )}
                      {(planType === 'platinum' || planType === 'enterprise') && (
                        <li className="flex space-x-3">
                          <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                          <span className="text-sm text-gray-500">Advanced analytics</span>
                        </li>
                      )}
                      {planType === 'enterprise' && (
                        <li className="flex space-x-3">
                          <Check className="flex-shrink-0 h-5 w-5 text-green-500" />
                          <span className="text-sm text-gray-500">Custom integrations</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* About Section */}
      <div id="about" className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">About</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Created with passion
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Goal Calendly is crafted by developers who understand the importance of achieving your dreams.
            </p>
          </div>

          <div className="mt-10">
            <div className="relative max-w-lg mx-auto">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-8 text-center text-white">
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4">
                    <Building className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">EZ Boss Dev</h3>
                <p className="text-lg opacity-90 mb-4">
                  Professional development solutions
                </p>
                <a 
                  href="https://ezbossdev.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Visit ezbossdev.com
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-400" />
              <span className="ml-2 text-xl font-bold text-white">Goal Calendly</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2024 Goal Calendly. Created by{' '}
              <a href="https://ezbossdev.com" className="text-blue-400 hover:text-blue-300">
                EZ Boss Dev
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}