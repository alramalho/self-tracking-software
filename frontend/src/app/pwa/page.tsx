'use client'

import Image from "next/image";

import { isNotifySupported, isGeoSupported, isStorageSupported } from "@/app/swSupport";
import { use, useEffect, useState } from "react";

export default function Home() {
  const [count, setCount] = useState(0);

  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isPwaSupported, setIsPwaSupported] = useState(false);
  const [isPushGranted, setIsPushGranted] = useState(false);

  const [currentGeo, setCurrentGeo] = useState<GeolocationPosition | null>(null);
  const [secretText, setSecretText] = useState<string>();

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if all the features we want are available
    // In practice, it is better to check for each feature separately and allow users to opt-in 
    // to each feature on demand.
    const hasRequisite = isNotifySupported() && isGeoSupported() && isStorageSupported();
    setIsPwaSupported(hasRequisite);

    if (window.serwist !== undefined && hasRequisite) {
      try {
        setIsPushGranted(Notification.permission === "granted")
      } catch (err) {
        console.info(err)
      }

      const beforeinstallprompt = (event: any) => {
        console.log("Before install prompt: ", event);
      }

      const appinstalled = (event: any) => {
        console.log("App installed: ", event);
      }

      // Register the service worker
      window.serwist.register()
        .then((result: any) => setRegistration(result))
        .catch((err: any) => alert(err)).catch((err: Error) => console.warn(err))

      window.addEventListener("beforeinstallprompt", beforeinstallprompt);
      window.addEventListener("appinstalled", appinstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", beforeinstallprompt);
        window.removeEventListener("appinstalled", appinstalled);
      }
    } else {
      console.warn("Serwist is not available or the requisite features are not available")
    }
  }, []);

  useEffect(() => {
    console.info("Service worker registration state: ", registration?.active?.state)
    setIsAppInstalled(registration?.active?.state === "activated")

    setServiceStorage()
  }, [registration?.active?.state])

  useEffect(() => {
    navigator.setAppBadge && navigator.setAppBadge(count)
  }, [count])

  const requestPermission = async () => {
    try {
      if (isPwaSupported)
        Notification.requestPermission().then(async (result) => {
          if (result === "granted") {
            setIsPushGranted(true);

            // Reload to make sure page is in the correct state with new permissions
            location.reload();

            // Permission state *should* match "granted" after above operation, but we check again
            // for safety. This is necessary if the subscription request is elsewhere in your flow
            const pm = await registration?.pushManager?.permissionState()
            if (pm === "granted")
              // https://developer.mozilla.org/en-US/docs/Web/API/PushManager
              // Requires HTTPS and a valid service worker to receive push notifications
              registration?.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: "HELLOWORLD",
              }).then((subscription) => {
                console.log(subscription.endpoint);
                // The push subscription details needed by the application
                // server are now available, and can be sent to it using,
                // for example, the fetch() API.
              }, (err) => console.warn(err))
          } else {
            alert("We weren't allowed to send you notifications. Permission state is: " + result);
          }
        })
      else {
        // Alert the user that they need to install the web page to use notifications 
        alert('You need to install this web page to use notifications');
      }
    } catch (err) {
      console.log(err)
    }
  }

  const randomNotification = async () => {
    if (!registration) return

    try {
      const result = await fetch("https://randomuser.me/api/?nat=us,fr,gb,mx,in")
        .then((response) => response.json())
        .then((data) => data.results[0]);

      const options = {
        body: `New message from ${result.name.first} ${result.name.last}`,
        title: `PWA Safari - ${count + 1}`,
        icon: result.picture.thumbnail,
        actions: [
          {
            action: "open",
            title: "Open the app",
          }
        ]
      };

      // You must use the service worker notification to show the notification
      // e.g - new Notification(notifTitle, options) does not work on iOS
      // despite working on other platforms
      await registration.showNotification("Message", options);

      // Set the badge count
      setCount(count + 1)
    } catch (err: any) {
      console.log("Encountered a problem: " + err.message)
      console.log(err)
      alert(err)
    }
  }

  const clearNotifications = async () => {
    // clear app badge
    navigator.clearAppBadge();
    setCount(0);

    // close notifcations (where supported)
    await registration?.getNotifications().then((notifications) => { notifications.forEach((notification) => notification.close()) });
  }

  const requestCurrentPosition = async () => {
    if (isGeoSupported()) {
      navigator.geolocation.getCurrentPosition((position) => {
        console.log(position.coords.latitude, position.coords.longitude);
        setCurrentGeo(position);
      })
    } else {
      console.warn("Geolocation is not supported")
    }
  }

  const setServiceStorage = async () => {
    if (isStorageSupported()) {
      navigator.storage.persist().then((persistent) => {
        if (persistent) {
          console.log("Storage will not be cleared except by explicit user action");
        } else {
          console.log("Storage may be cleared by the UA under storage pressure.");
        }
      })
      // Service worker is not required to use localStorage
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
      localStorage.setItem("Test", "it's a secret to everybody")
    } else {
      console.warn("Storage is not supported")
    }
  }

  const getServiceStorage = async () => {
    const saved = localStorage.getItem('Test');
    if (saved) setSecretText(saved)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-black text-white">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-700 bg-gradient-to-b from-zinc-800 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-200 dark:bg-zinc-200/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-800 lg:p-4 lg:dark:bg-zinc-200/30">
          {currentGeo && (
            <code className="font-mono font-bold w-100">{currentGeo.coords.latitude}, {currentGeo.coords.longitude}</code>
          )}
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-black via-black dark:from-white dark:via-white lg:static lg:h-auto lg:w-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://vercel.com?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            By{" "}
            <Image
              src="/vercel.svg"
              alt="Vercel Logo"
              className="invert"
              width={100}
              height={24}
              priority
            />
          </a>
        </div>
      </div>

      {isAppInstalled && (<button
        className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
      >
        <h2 className={`mb-3 text-2xl font-semibold`}>
          Installed{" "}
          <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
            ✔
          </span>
        </h2>
        <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
          Service worker is registered.
        </p>
      </button>)}

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        {!isPwaSupported && (<button
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Installed{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              ✖️
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Install this page as an app to get started
          </p>
        </button>)}


        {!isPushGranted && (
          <button
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
            onClick={() => requestPermission()}
          >
            <h2 className={`mb-3 text-2xl font-semibold`}>
              Push{" "}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                ✖️
              </span>
            </h2>
            <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
              Enable Push Notifications
            </p>
          </button>)}

        {isAppInstalled && isPushGranted && (
          <button
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
            onClick={() => randomNotification()}
          >
            <h2 className={`mb-3 text-2xl font-semibold`}>
              Push{" "}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                ✔
              </span>
            </h2>
            <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
              Test Push Notifications
            </p>
          </button>)}

        {isAppInstalled && isPushGranted && (
          <button
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
            onClick={() => clearNotifications()}
          >
            <h2 className={`mb-3 text-2xl font-semibold`}>
              Push{" "}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                ✔
              </span>
            </h2>
            <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
              Clear Badge Counter
            </p>
          </button>)}

        {isAppInstalled && isGeoSupported() && (<button
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
          onClick={() => requestCurrentPosition()}
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Location{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              ✔
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Get current coordinates.
          </p>
        </button>)}

        {isAppInstalled && isStorageSupported() && (<button
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:dark:border-neutral-300 hover:dark:bg-neutral-200/30"
          onClick={() => getServiceStorage()}
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Storage{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              ✔
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Reveal a storage entry.
          </p>
        </button>)}
      </div>
    </main>
  );
}
