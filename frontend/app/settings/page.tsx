"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Bell, Moon, Shield, Sun } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
  const { address, connectWallet, disconnectWallet } = useWallet()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("account")
  const [theme, setTheme] = useState("dark")
  const [language, setLanguage] = useState("en")
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 },
    },
  }

  const saveSettings = () => {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated",
    })
  }

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-6">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-8">Please connect your wallet to access settings</p>
          <Button onClick={connectWallet} className="bg-gradient-to-r from-purple-600 to-blue-600">
            Connect Wallet
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-400 mb-6">Customize your experience and manage your account</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-white/10">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="mt-4 space-y-6">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Manage your account details and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="wallet-address">Wallet Address</Label>
                    <div className="flex">
                      <Input id="wallet-address" value={address} readOnly className="bg-black/30 border-white/10" />
                      <Button variant="outline" className="ml-2 border-white/10">
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display Name (Optional)</Label>
                    <Input
                      id="display-name"
                      placeholder="Enter a display name"
                      className="bg-black/30 border-white/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      className="bg-black/30 border-white/10"
                    />
                    <p className="text-xs text-gray-400">Used for notifications and recovery</p>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Notification Preferences</h3>

                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="email-notifications" className="flex items-center space-x-2">
                        <Bell className="h-4 w-4" />
                        <span>Email Notifications</span>
                      </Label>
                      <Switch
                        id="email-notifications"
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                      <Label htmlFor="push-notifications" className="flex items-center space-x-2">
                        <Bell className="h-4 w-4" />
                        <span>Push Notifications</span>
                      </Label>
                      <Switch
                        id="push-notifications"
                        checked={pushNotifications}
                        onCheckedChange={setPushNotifications}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" className="border-white/10" onClick={disconnectWallet}>
                    Disconnect Wallet
                  </Button>
                  <Button
                    onClick={saveSettings}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-4 space-y-6">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Appearance Settings</CardTitle>
                  <CardDescription>Customize how the application looks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Theme</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className={`p-4 rounded-lg border cursor-pointer flex items-center justify-center flex-col gap-2 ${theme === "dark"
                          ? "bg-gray-900 border-purple-500"
                          : "bg-gray-900/50 border-white/10 hover:border-white/30"
                          }`}
                        onClick={() => setTheme("dark")}
                      >
                        <Moon className="h-6 w-6 text-purple-400" />
                        <span>Dark</span>
                      </div>

                      <div
                        className={`p-4 rounded-lg border cursor-pointer flex items-center justify-center flex-col gap-2 ${theme === "light"
                          ? "bg-gray-900 border-purple-500"
                          : "bg-gray-900/50 border-white/10 hover:border-white/30"
                          }`}
                        onClick={() => setTheme("light")}
                      >
                        <Sun className="h-6 w-6 text-amber-400" />
                        <span>Light</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger id="language" className="bg-black/30 border-white/10">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={saveSettings}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Save Preferences
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-4 space-y-6">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage your account security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-medium">Two-Factor Authentication #TODO</h3>
                        <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
                      </div>
                      <Switch id="two-factor" checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} />
                    </div>

                    {twoFactorEnabled && (
                      <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 space-y-4">
                        <p className="text-sm">
                          Scan the QR code with an authenticator app like Google Authenticator or Authy.
                        </p>
                        <div className="flex justify-center">
                          <div className="w-40 h-40 bg-white p-2 rounded-lg">
                            <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                              <span className="text-black">QR Code</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="verification-code">Verification Code</Label>
                          <Input
                            id="verification-code"
                            placeholder="Enter 6-digit code"
                            className="bg-black/30 border-white/10"
                          />
                        </div>
                        <Button className="w-full bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-600">
                          Verify and Enable
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Connected Devices</h3>
                    <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <Shield className="h-5 w-5 text-green-400 mr-2" />
                          <div>
                            <div className="font-medium">Current Device</div>
                            <div className="text-xs text-gray-400">Last active: Just now</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-green-500 text-green-400">
                          Active
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Recovery Email</h3>
                    <p className="text-sm text-gray-400">
                      This email will be used for account recovery and security alerts
                    </p>
                    <Input placeholder="recovery@email.com" className="bg-black/30 border-white/10" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={saveSettings}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    Save Security Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  )
}
