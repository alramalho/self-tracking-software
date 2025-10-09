// import { Browser } from '@capacitor/browser';
// import { Capacitor } from '@capacitor/core';
// import { App } from '@capacitor/app';
// import { useEffect } from 'react';

// interface MobileAuthButtonProps {
//   mode: 'signin' | 'signup';
// }

// export function MobileAuthButton({ mode }: MobileAuthButtonProps) {
//   // Listen for deep link callback
//   useEffect(() => {
//     const handleDeepLink = App.addListener('appUrlOpen', async (data) => {
//       console.log('Deep link received:', data.url);

//       // Check if it's our auth callback
//       if (data.url.startsWith('trackingso://auth-callback')) {
//         console.log('Auth callback detected!');

//         // Close the browser
//         await Browser.close();

//         // Extract session info from URL
//         const url = new URL(data.url);
//         const clerkStatus = url.searchParams.get('__clerk_status');
//         const sessionId = url.searchParams.get('__clerk_created_session');

//         console.log('Clerk callback:', { clerkStatus, sessionId });

//         if (clerkStatus === 'verified' || clerkStatus === 'complete') {
//           // Success! Store session and reload
//           console.log('Auth successful, reloading app...');

//           // Reload to let Clerk pick up the session
//           window.location.href = '/';
//         }
//       }
//     });

//     return () => {
//       handleDeepLink.remove();
//     };
//   }, []);

//   const handleAuth = async () => {
//     try {
//       const clerkUrl = 'https://dynamic-swift-22.accounts.dev';
//       const authPath = mode === 'signin' ? '/sign-in' : '/sign-up';

//       // Open Clerk's auth page in Safari
//       const callback = encodeURIComponent('trackingso://auth-callback');
//       await Browser.open({
//         url: `${clerkUrl}${authPath}?redirect_url=${callback}`,
//         presentationStyle: 'popover',
//       });
//     } catch (error) {
//       console.error('Failed to open auth:', error);
//     }
//   };

//   if (!Capacitor.isNativePlatform()) {
//     return null;
//   }

//   return (
//     <div className="flex flex-col items-center justify-center gap-4 p-8">
//       <h1 className="text-2xl font-bold">
//         {mode === 'signin' ? 'Sign In' : 'Sign Up'}
//       </h1>
//       <p className="text-gray-600 text-center">
//         You'll be redirected to sign {mode === 'signin' ? 'in' : 'up'} securely in your browser
//       </p>
//       <button
//         onClick={handleAuth}
//         className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
//       >
//         Continue to {mode === 'signin' ? 'Sign In' : 'Sign Up'}
//       </button>
//     </div>
//   );
// }
