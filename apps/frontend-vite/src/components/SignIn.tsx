import React from 'react'
import { SignIn as ClerkSignIn } from '@clerk/clerk-react'

interface SignInProps {
  signUpUrl?: string
  forceRedirectUrl?: string | null
  appearance?: {
    elements?: {
      rootBox?: string
      card?: string
    }
  }
}

export const SignIn: React.FC<SignInProps> = ({
  signUpUrl = '/signup',
  forceRedirectUrl,
  appearance
}) => {
  return (
    <ClerkSignIn
      signUpUrl={signUpUrl}
      forceRedirectUrl={forceRedirectUrl || undefined}
      appearance={{
        elements: {
          rootBox: appearance?.elements?.rootBox || "w-full",
          card: appearance?.elements?.card || "shadow-none",
        }
      }}
    />
  )
}