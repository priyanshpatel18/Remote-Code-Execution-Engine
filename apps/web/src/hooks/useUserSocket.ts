import { useEffect, useState } from "react";
import { useSocket } from "./useSocket";
import { useUser } from "./useUser";

export default function useUserSocket() {
  const { user, loading } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const { socket, connectionType } = useSocket({ token });

  useEffect(() => {
    if (user && !loading) {
      setToken(user.token);
    }
  }, [loading, user]);

  return { socket, socketUser: user, connectionType };
}
