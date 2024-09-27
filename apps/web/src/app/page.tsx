"use client";

import EditorOutput from "@/components/EditorAndOutput";
import SignInDialog from "@/components/SignInDialog";
import Topbar from "@/components/Topbar";
import useUserSocket from "@/hooks/useUserSocket";
import { CONNECTED, UPDATE_USER } from "@repo/messages";
import { UserDetails } from "@repo/types";
import { useEffect, useState } from "react";

export interface Language {
  value: string;
  label: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function Home() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>({
    value: "PYTHON",
    label: "PYTHON",
  });
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [user, setUser] = useState<UserDetails | null>(null);
  const { socket, socketUser } = useUserSocket();
  const [output, setOutput] = useState<string | null>(null);

  // useEffect(() => {
  //   checkAuth();
  // }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }
    if (socket) {
      setUser(socketUser);
    }

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === CONNECTED) {
        console.log(CONNECTED);
      }

      if (data.type === UPDATE_USER) {
        setOutput(data.payload);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, socketUser]);

  async function checkAuth() {
    const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.user) {
      setIsSignedIn(false);
      setShowDialog(true);
    } else {
      setUser(data.user);
      setIsSignedIn(true);
      setShowDialog(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Topbar
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />
      <div className="flex-1 overflow-hidden">
        <EditorOutput
          selectedLanguage={selectedLanguage.value}
          isSignedIn={isSignedIn}
          user={user}
          output={output}
          setOutput={setOutput}
        />
      </div>

      <SignInDialog
        isOpen={showDialog}
        setIsOpen={setShowDialog}
        setUser={setUser}
      />
    </div>
  );
}
