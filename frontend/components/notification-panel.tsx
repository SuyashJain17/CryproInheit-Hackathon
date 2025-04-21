"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { motion } from "framer-motion"

interface NotificationPanelProps {
  onClose: () => void
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  // Mock notifications data
  const notifications = [
    {
      id: 1,
      title: "Inactivity Warning",
      message: "Your account will be considered inactive in 10 days. Log in to reset the timer.",
      time: "2 hours ago",
      type: "warning",
      read: false,
    },
    {
      id: 2,
      title: "Beneficiary Added",
      message: "You successfully added a new beneficiary to your inheritance plan.",
      time: "1 day ago",
      type: "success",
      read: false,
    },
    {
      id: 3,
      title: "Wallet Connected",
      message: "Your wallet has been successfully connected to the platform.",
      time: "2 days ago",
      type: "info",
      read: true,
    },
    {
      id: 4,
      title: "Transaction Completed",
      message: "Your transaction of 0.5 ETH has been confirmed.",
      time: "3 days ago",
      type: "success",
      read: true,
    },
    {
      id: 5,
      title: "Security Alert",
      message: "A new device was used to access your account.",
      time: "1 week ago",
      type: "warning",
      read: true,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-80 md:w-96"
    >
      <Card className="bg-black/80 backdrop-blur-sm border border-white/10">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-lg">Notifications</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <Separator className="bg-white/10" />
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="space-y-0">
              {notifications.map((notification) => (
                <div key={notification.id}>
                  <div
                    className={`p-4 ${notification.read ? "" : "bg-purple-900/10"} hover:bg-gray-900/50 transition-colors`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-medium ${notification.read ? "text-gray-200" : "text-white"}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-gray-400">{notification.time}</span>
                    </div>
                    <p className="text-sm text-gray-300">{notification.message}</p>
                  </div>
                  <Separator className="bg-white/5" />
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 text-center">
            <Button variant="link" className="text-sm text-blue-400">
              View All Notifications
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
