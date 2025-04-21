"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  Clock,
  CreditCard,
  Info,
  Settings,
  Shield,
  User,
  Wallet,
  Plus,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotificationPanel from "@/components/notification-panel";
import { ethers } from "ethers";
import { inheritanceABI } from "@/lib/abis/InheritanceContract";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const contractAddress = "0xbc3dCfD875126879E7e2286c328eBb26725aC44B";

const provider = new ethers.JsonRpcProvider(
  "https://arb-sepolia.g.alchemy.com/v2/f9bE8l6qwQCIYwFnkd-iPUFehrLW1wtY"
);
const contract = new ethers.Contract(contractAddress, inheritanceABI, provider);

export default function Dashboard() {
  const { address, balance, connectWallet } = useWallet();
  const [progress, setProgress] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  const [planExists, setPlanExists] = useState(false);
  const [planDetails, setPlanDetails] = useState({
    balance: 0,
    beneficiaryCount: 0,
    lastReset: 0,
    timeoutPeriod: 0,
    perBeneficiaryShare: 0,
    shareLocked: false,
    protocolShare: 0,
  });
  const [showDialog, setShowDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.0001");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [beneficiaries, setBeneficiaries] = useState<
    {
      id: number;
      name: string;
      address: string;
      percentage: number;
      relationship: string;
    }[]
  >([]);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchContractData();
    }
  }, [address]);

  useEffect(() => {
    if (planExists) {
      const beneficiaryProgress = planDetails?.beneficiaryCount > 0 ? 50 : 0;
      const balanceProgress = planDetails?.balance > 0 ? 50 : 0;
      setProgress(beneficiaryProgress + balanceProgress);
    } else {
      setProgress(0);
    }
  }, [planDetails, planExists]);

  async function fetchContractData() {
    if (!address) return;

    setIsLoading(true);
    try {
      const ownerExists = await contract.ownerExists(address);
      setPlanExists(ownerExists);

      if (ownerExists) {
        const details = await contract.getPlanDetails(address);

        setPlanDetails({
          balance: Number(ethers.formatEther(details[0] || 0)),
          beneficiaryCount: Number(details[1] || 0),
          lastReset: Number(details[2] || 0),
          timeoutPeriod: Number(details[3] || 0),
          perBeneficiaryShare: Number(ethers.formatEther(details[4] || 0)),
          shareLocked: details[5] || false,
          protocolShare: Number(ethers.formatEther(details[6] || 0)),
        });

        const expired = await contract.isOwnerExpired(address);
        setIsExpired(expired);

        const remaining = await contract.timeRemaining(address);
        setTimeRemaining(Number(remaining || 0));

        const placeholderBeneficiaries = [];
        for (let i = 0; i < Number(details[1]); i++) {
          placeholderBeneficiaries.push({
            id: i + 1,
            name: `Beneficiary ${i + 1}`,
            address: `0x${"0".repeat(40)}`, // Placeholder address
            percentage: 100 / Number(details[1]),
            relationship: "Unknown",
          });
        }
        setBeneficiaries(placeholderBeneficiaries);
      } else {
        resetContractData();
      }
    } catch (error) {
      console.error("Error fetching contract data:", error);
      resetContractData();
    } finally {
      setIsLoading(false);
    }
  }

  function resetContractData() {
    setPlanDetails({
      balance: 0,
      beneficiaryCount: 0,
      lastReset: 0,
      timeoutPeriod: 0,
      perBeneficiaryShare: 0,
      shareLocked: false,
      protocolShare: 0,
    });
    setTimeRemaining(0);
    setBeneficiaries([]);
    setIsExpired(false);
  }

  function formatTimeRemaining(seconds: number) {
    if (seconds <= 0) return "Expired";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days} days, ${hours} hours`;
    } else if (hours > 0) {
      return `${hours} hours, ${minutes} minutes`;
    } else {
      return `${minutes} minutes`;
    }
  }

  function calculateTimePercentage() {
    if (!planDetails?.timeoutPeriod) return 0;

    const elapsed = planDetails?.timeoutPeriod - timeRemaining;
    return Math.min(
      100,
      Math.max(0, Math.floor((elapsed / planDetails?.timeoutPeriod) * 100))
    );
  }

  const recentTransactions = [
    {
      id: 1,
      type: "received",
      amount: planExists
        ? `${(planDetails?.balance * 0.1).toFixed(4)} ETH`
        : "0 ETH",
      from: address
        ? `${address.substring(0, 6)}...${address.substring(
          address.length - 4
        )}`
        : "0x0000...0000",
      timestamp: "2 hours ago",
      status: "completed",
    },
    {
      id: 2,
      type: "sent",
      amount: planExists
        ? `${(planDetails?.balance * 0.05).toFixed(4)} ETH`
        : "0 ETH",
      to: "0x5e6f...7g8h",
      timestamp: "1 day ago",
      status: "completed",
    },
  ];

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500">
            Secure Your Crypto Legacy
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Ensure your digital assets are passed on to your chosen
            beneficiaries after a period of inactivity.
          </p>

          <div className="grid-pattern w-full h-64 rounded-xl overflow-hidden relative mb-10">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 to-blue-900/30" />
            <motion.div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center animate-float"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <Wallet className="w-12 h-12 text-white" />
            </motion.div>

            <motion.div
              className="absolute top-1/3 left-1/4 w-4 h-4 rounded-full bg-purple-500 animate-pulse-slow"
              animate={{
                y: [0, -20, 0],
                x: [0, 10, 0],
              }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute bottom-1/3 right-1/4 w-3 h-3 rounded-full bg-blue-500 animate-pulse-slow"
              animate={{
                y: [0, 20, 0],
                x: [0, -15, 0],
              }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute top-2/3 right-1/3 w-2 h-2 rounded-full bg-cyan-500 animate-pulse-slow"
              animate={{
                y: [0, 15, 0],
                x: [0, 20, 0],
              }}
              transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY }}
            />
          </div>

          <Button
            onClick={connectWallet}
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all duration-300"
          >
            Connect Wallet to Start
          </Button>
        </motion.div>
      </div>
    );
  }

  async function handleWithdraw(): Promise<void> {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        contractAddress,
        inheritanceABI,
        signer
      );

      const tx = await contract.withdrawAll();
      await tx.wait();

      console.log("Funds withdrawn:", tx.hash);
      fetchContractData();
    } catch (error) {
      console.error("Error withdrawing funds:", error);
    }
  }


  //@ts-ignore
  async function handleAddAssets(): Promise<void> {

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        contractAddress,
        inheritanceABI,
        signer
      );

      const tx = await contract.addFunds({
        value: ethers.parseEther(depositAmount),
      });

      await tx.wait();

      console.log("Funds added:", tx.hash);
      setPlanExists(true);
      setShowDialog(false);
      setAmount("");
    } catch (error) {
      console.error("Error sending funds:", error);
    }
  }

  const resetTimer = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, inheritanceABI, signer);

      const tx = await contract.resetTimer()
      await tx.wait();

      console.log("Timer reset:", tx.hash);

      // Re-fetch plan details
      fetchContractData();

      setPlanExists(true);
      setIsExpired(false);
      setAmount("");
    } catch (error) {
      console.error("Error resetting timer:", error);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.div
          variants={{
            hidden: { y: 20, opacity: 0 },
            visible: {
              y: 0,
              opacity: 1,
              transition: { duration: 0.5 },
            },
          }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome to Your Dashboard
            </h1>
            <p className="text-gray-400">
              Manage your crypto inheritance settings and beneficiaries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={fetchContractData}
              variant="outline"
              size="icon"
              className="border-white/10 hover:bg-white/5"
            >
              <CreditCard className="h-5 w-5" />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative border-white/10 hover:bg-white/5"
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setUnreadNotifications(0);
                    }}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notifications</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-white/10 hover:bg-white/5"
                    asChild
                  >
                    <Link href="/settings">
                      <Settings className="h-5 w-5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </motion.div>

        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-4 md:right-8 top-20 z-50"
          >
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          </motion.div>
        )}

        <motion.div
          variants={{
            hidden: { y: 20, opacity: 0 },
            visible: {
              y: 0,
              opacity: 1,
              transition: { duration: 0.5 },
            },
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-purple-500" />
                Wallet Balance
              </CardTitle>
              <CardDescription>Your current crypto assets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-24 bg-gray-800 animate-pulse rounded"></div>
                ) : (
                  `${planDetails?.balance.toFixed(4)} ETH`
                )}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {isLoading ? (
                  <div className="h-4 w-32 bg-gray-800 animate-pulse rounded"></div>
                ) : (
                  `Total value: $${(planDetails?.balance * 1800).toFixed(2)}`
                )}
              </div>

              {/* Withdraw Button */}
              <div className="mt-4">
                <button
                  onClick={handleWithdraw} // Replace with your actual withdraw handler
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  Withdraw Money
                </button>
              </div>
            </CardContent>
          </Card>


          <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Shield className="w-5 h-5 mr-2 text-blue-500" />
                Inheritance Status
              </CardTitle>
              <CardDescription>Your inheritance plan setup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Setup Progress</span>
                  <span>{isLoading ? "..." : `${progress}%`}</span>
                </div>
                <Progress value={isLoading ? 0 : progress} className="h-2" />
                <div className="text-sm text-gray-400 mt-2">
                  {isLoading ? (
                    <div className="h-4 w-full bg-gray-800 animate-pulse rounded"></div>
                  ) : !planExists ? (
                    <span className="flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1 text-amber-500" />
                      No inheritance plan found
                    </span>
                  ) : progress < 100 ? (
                    <span className="flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1 text-amber-500" />
                      Complete your setup to activate inheritance
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Shield className="w-4 h-4 mr-1 text-green-500" />
                      Inheritance plan active
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="link"
                className="p-0 h-auto text-blue-400"
                asChild
              >
                <Link href="/beneficiaries">
                  {planExists ? "Manage Plan" : "Create Plan"}{" "}
                  <ArrowRight className="ml-1 w-4 h-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Clock className="w-5 h-5 mr-2 text-cyan-500" />
                Activity Status
              </CardTitle>
              <CardDescription>Time until inheritance trigger</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-20 bg-gray-800 animate-pulse rounded"></div>
                  <div className="h-4 w-32 bg-gray-800 animate-pulse rounded"></div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="h-4 w-full bg-gray-800 animate-pulse rounded"></div>
                    <div className="mt-2 h-2.5 w-full bg-gray-800 animate-pulse rounded-full"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`text-xl font-medium ${isExpired ? "text-red-500" : "text-green-500"
                      }`}
                  >
                    {isExpired ? "Expired" : "Active"}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Last activity:{" "}
                    {planExists
                      ? new Date(planDetails?.lastReset * 1000).toLocaleString()
                      : "N/A"}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-sm">
                      Inactivity threshold:{" "}
                      <span className="font-medium">
                        {planExists
                          ? formatTimeRemaining(planDetails?.timeoutPeriod)
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center mt-2">
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div
                          className={`${isExpired ? "bg-red-500" : "bg-green-500"
                            } h-2.5 rounded-full`}
                          style={{ width: `${calculateTimePercentage()}%` }}
                        ></div>
                      </div>
                      <span className="ml-2 text-xs text-gray-400">
                        {calculateTimePercentage().toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            {planExists && !isExpired && (
              <CardFooter>
                <Button
                  onClick={resetTimer}
                  className="w-full bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-600 hover:to-blue-600"
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Timer"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </motion.div>

        <motion.div
          variants={{
            hidden: { y: 20, opacity: 0 },
            visible: {
              y: 0,
              opacity: 1,
              transition: { duration: 0.5 },
            },
          }}
        >
          <Tabs defaultValue="assets" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-black/40 border border-white/10">
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="beneficiaries">Beneficiaries</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="assets" className="mt-4">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Your Digital Assets</CardTitle>
                  <CardDescription>
                    Assets that will be included in your inheritance plan
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-20 bg-gray-800 animate-pulse rounded-lg"
                        ></div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {planExists && planDetails?.balance > 0 ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-white/5">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600/50 to-blue-600/50 flex items-center justify-center mr-3">
                              <span className="font-bold text-white">ETH</span>
                            </div>
                            <div>
                              <div className="font-medium">Ethereum</div>
                              <div className="text-sm text-gray-400">ETH</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {planDetails?.balance.toFixed(4)} ETH
                            </div>
                            <div className="text-sm text-gray-400">
                              ${(planDetails?.balance * 1800).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-gray-400">
                          No assets found in your inheritance plan.
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">
                            Total Estimated Value
                          </span>
                          <span className="font-bold text-xl">
                            ${(planDetails?.balance * 1800).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-600"
                    onClick={() => setShowDialog(true)}
                  >
                    Add More Assets
                  </Button>
                  {showDialog && (
                    <Dialog open={showDialog} onOpenChange={setShowDialog}>
                      <DialogContent className="bg-gray-950 border border-white/10 text-white">
                        <DialogHeader>
                          <DialogTitle>Add Funds</DialogTitle>
                          <DialogDescription>
                            You need to deposit ETH to create your inheritance plan. This will
                            be distributed to your beneficiaries after the inactivity period.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="deposit-amount">Deposit Amount (ETH)</Label>
                            <Input
                              id="deposit-amount"
                              type="number"
                              step="0.01"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              className="bg-black/30 border-white/10"
                            />
                            <p className="text-xs text-gray-400">
                              This amount will be locked in the contract and distributed to
                              your beneficiaries if the inactivity period is reached.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Plan Summary</h4>
                            <div className="bg-black/30 rounded-lg p-3 text-sm">
                              <div className="flex justify-between py-1">
                                <span className="text-gray-400">Beneficiaries:</span>
                                <span>{beneficiaries.length}</span>
                              </div>
                              <div className="flex justify-between py-1">
                                <span className="text-gray-400">Deposit Amount:</span>
                                <span>{depositAmount} ETH</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowCreateDialog(false)}
                            className="border-white/10"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddAssets}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          >
                            Add funds
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}


                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="mt-4">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Recent Transactions #TODO</CardTitle>
                  <CardDescription>
                    Your recent cryptocurrency transactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-20 bg-gray-800 animate-pulse rounded-lg"
                        ></div>
                      ))}
                    </div>
                  ) : (
                    <ScrollArea className="h-[320px] pr-4">
                      <div className="space-y-4">
                        {recentTransactions.length > 0 ? (
                          recentTransactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-white/5"
                            >
                              <div className="flex items-center">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${tx.type === "received"
                                    ? "bg-green-900/50"
                                    : "bg-blue-900/50"
                                    }`}
                                >
                                  {tx.type === "received" ? (
                                    <ArrowDown className="w-5 h-5 text-green-400" />
                                  ) : (
                                    <ArrowUp className="w-5 h-5 text-blue-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">
                                    {tx.type === "received"
                                      ? "Received"
                                      : "Sent"}{" "}
                                    {tx.amount}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {tx.type === "received"
                                      ? `From: ${tx.from}`
                                      : `To: ${tx.to}`}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {tx.timestamp}
                                </div>
                                <div className="text-sm">
                                  <Badge
                                    variant="outline"
                                    className="border-green-500 text-green-400"
                                  >
                                    {tx.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-6 text-center text-gray-400">
                            No transactions found.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    className="border-white/10"
                    disabled={!planExists}
                  >
                    Export History
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-600"
                    disabled={!planExists}
                  >
                    View All Transactions
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="beneficiaries" className="mt-4">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Your Beneficiaries</CardTitle>
                  <CardDescription>
                    People who will receive your assets
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-20 bg-gray-800 animate-pulse rounded-lg"
                        ></div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {beneficiaries.length > 0 ? (
                        beneficiaries.map((beneficiary) => (
                          <div
                            key={beneficiary.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-white/5"
                          >
                            <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600/50 to-blue-600/50 flex items-center justify-center mr-3">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="font-medium">
                                  {beneficiary.name}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {beneficiary.address}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Relationship: {beneficiary.relationship}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {beneficiary.percentage.toFixed(0)}% Share
                              </div>
                              <Button
                                variant="link"
                                className="p-0 h-auto text-sm text-blue-400"
                                onClick={() => { window.location.href = '/beneficiaries' }}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-gray-400">
                          No beneficiaries found. Add beneficiaries to your
                          inheritance plan.
                        </div>
                      )}

                      {planExists && (
                        <div className="p-3 rounded-lg bg-gray-900/50 border border-white/5 border-dashed flex items-center justify-center">
                          <Button
                            variant="ghost"
                            className="text-gray-400 hover:text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Another Beneficiary
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 p-4 rounded-lg bg-blue-900/20 border border-blue-900/30">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-400">
                          Inheritance Terms
                        </h4>
                        <p className="text-sm text-gray-300 mt-1">
                          {planExists
                            ? `Your assets will be transferred to your beneficiaries after ${formatTimeRemaining(
                              planDetails?.timeoutPeriod
                            )} of inactivity. You can reset this timer by logging in or performing any transaction.`
                            : "Create an inheritance plan to set up terms for your beneficiaries."}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-600"
                  >
                    <Link href="/beneficiaries">
                      {planExists
                        ? "Manage Beneficiaries"
                        : "Create Inheritance Plan"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Your recent transactions and actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-6 pl-10 relative">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-16 bg-gray-800 animate-pulse rounded-lg"
                        ></div>
                      ))}
                    </div>
                  ) : (
                    <ScrollArea className="h-[320px] pr-4">
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10"></div>

                        <div className="space-y-6 pl-10 relative">
                          {planExists ? (
                            <>
                              <div className="relative">
                                <div className="absolute -left-10 mt-1.5 w-4 h-4 rounded-full bg-blue-500"></div>
                                <div>
                                  <div className="flex items-center">
                                    <h4 className="font-medium">
                                      Wallet Connected
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="ml-2 border-blue-500 text-blue-400"
                                    >
                                      Just now
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-400 mt-1">
                                    You connected your wallet to the platform
                                  </p>
                                </div>
                              </div>

                              <div className="relative">
                                <div className="absolute -left-10 mt-1.5 w-4 h-4 rounded-full bg-green-500"></div>
                                <div>
                                  <div className="flex items-center">
                                    <h4 className="font-medium">
                                      Last Activity
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="ml-2 border-green-500 text-green-400"
                                    >
                                      {new Date(
                                        planDetails?.lastReset * 1000
                                      ).toLocaleString()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-400 mt-1">
                                    You reset the inactivity timer
                                  </p>
                                </div>
                              </div>

                              <div className="relative">
                                <div className="absolute -left-10 mt-1.5 w-4 h-4 rounded-full bg-amber-500"></div>
                                <div>
                                  <div className="flex items-center">
                                    <h4 className="font-medium">
                                      Inheritance Plan Created
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="ml-2 border-amber-500 text-amber-400"
                                    >
                                      {new Date(
                                        planDetails?.lastReset * 1000
                                      ).toLocaleString()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-400 mt-1">
                                    You created your inheritance plan with{" "}
                                    {planDetails?.beneficiaryCount} beneficiaries
                                  </p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="p-6 text-center text-gray-400">
                              No activity found. Create an inheritance plan to
                              start tracking activity.
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-600"
                    disabled={!planExists}
                  >
                    View Full Activity Log
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.div
          variants={{
            hidden: { y: 20, opacity: 0 },
            visible: {
              y: 0,
              opacity: 1,
              transition: { duration: 0.5 },
            },
          }}
        >
          <Card className="bg-black/40 border border-white/10 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-900/30 to-blue-900/30">
              <CardTitle>Educational Resources</CardTitle>
              <CardDescription>
                Learn more about blockchain inheritance and best practices
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-purple-500/50 transition-colors">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-purple-400" />
                    Inheritance Security
                  </h3>
                  <p className="text-sm text-gray-400">
                    Learn how our blockchain inheritance system keeps your
                    assets secure.
                  </p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-purple-400 mt-2"
                  >
                    Read More
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-blue-500/50 transition-colors">
                  <h3 className="font-medium mb-2 flex items-center">
                    <User className="w-4 h-4 mr-2 text-blue-400" />
                    Beneficiary Best Practices
                  </h3>
                  <p className="text-sm text-gray-400">
                    Tips for selecting and managing your inheritance
                    beneficiaries.
                  </p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-blue-400 mt-2"
                  >
                    Read More
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-cyan-500/50 transition-colors">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-cyan-400" />
                    Inactivity Monitoring
                  </h3>
                  <p className="text-sm text-gray-400">
                    Understanding how the inactivity monitoring system works.
                  </p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm text-cyan-400 mt-2"
                  >
                    Read More
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
