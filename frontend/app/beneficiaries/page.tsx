"use client";
import { isAddress } from "ethers";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  Clock,
  Download,
  FileText,
  Info,
  Plus,
  Trash2,
  User,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ethers } from "ethers";
import { inheritanceABI } from "@/lib/abis/InheritanceContract";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const contractAddress = "0xbc3dCfD875126879E7e2286c328eBb26725aC44B";

interface Beneficiary {
  id: string;
  address: string;
  percentage: number;
  name: string;
  relationship: string;
  email?: string;
  contact?: string;
}

export default function BeneficiariesPage() {
  const { address, connectWallet, balance, disconnectWallet } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [inactivityPeriod, setInactivityPeriod] = useState(90); // days
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [activeTab, setActiveTab] = useState("beneficiaries");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [planExists, setPlanExists] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [depositAmount, setDepositAmount] = useState("0.1");
  const [isCreating, setIsCreating] = useState(false);


  useEffect(() => {
    const loadBeneficiaries = async () => {
      const addresses = await fetchAllBeneficiaries();
      console.log("Beneficiary addresses:", addresses);

      // You can set these in state, e.g., with empty names/percentages to start
      setBeneficiaries(
        addresses.map((addr, index) => ({
          id: `${index}`,
          address: addr,
          percentage: 0,
          name: `Beneficiary ${index + 1}`,
          relationship: "",
        }))
      );
    };

    if (planExists && address) {
      loadBeneficiaries();
    }
  }, [address, planExists]);

  // Check if plan exists when component mounts
  useEffect(() => {
    if (address) {
      checkPlanExists();
    }
  }, [address]);

  // Check if the user already has an inheritance plan
  async function checkPlanExists() {
    if (!address) return;

    try {
      const provider = new ethers.JsonRpcProvider(
        "https://arb-sepolia.g.alchemy.com/v2/f9bE8l6qwQCIYwFnkd-iPUFehrLW1wtY"
      );
      const contract = new ethers.Contract(
        contractAddress,
        inheritanceABI,
        provider
      );
      const exists = await contract.ownerExists(address);
      setPlanExists(exists);
    } catch (error) {
      console.error("Error checking if plan exists:", error);
    }
  }

  const fetchAllBeneficiaries = async () => {
    if (!address) return [];

    try {
      const provider = new ethers.JsonRpcProvider(
        "https://arb-sepolia.g.alchemy.com/v2/f9bE8l6qwQCIYwFnkd-iPUFehrLW1wtY"
      );
      const contract = new ethers.Contract(contractAddress, inheritanceABI, provider);

      const beneficiaryAddresses: string[] = await contract.getAllBeneficiaries(address);
      console.log("Beneficiary addresses from contract:", beneficiaryAddresses);
      return beneficiaryAddresses;
    } catch (error) {
      console.error("Error fetching beneficiaries:", error);
      return [];
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 },
    },
  };

  const addBeneficiary = () => {
    if (beneficiaries.length >= 5) {
      toast({
        title: "Maximum beneficiaries reached",
        description: "You can add up to 5 beneficiaries",
        variant: "destructive",
      });
      return;
    }

    const newId = Date.now().toString();
    setBeneficiaries([
      ...beneficiaries,
      {
        id: newId,
        address: "",
        percentage: 0,
        name: `Beneficiary ${beneficiaries.length + 1}`,
        relationship: "",
      },
    ]);
  };

  const removeBeneficiary = (id: string) => {
    if (beneficiaries.length <= 1) {
      toast({
        title: "Cannot remove all beneficiaries",
        description: "At least one beneficiary is required",
        variant: "destructive",
      });
      return;
    }

    setBeneficiaries(beneficiaries.filter((b) => b.id !== id));
  };

  const updateBeneficiary = async (
    id: string,
    field: keyof Beneficiary,
    value: string | number
  ) => {
    if (field === "address") {
      if (!isAddress(value as string)) {
        toast({
          title: "Invalid address",
          description: "Please enter a valid Ethereum address",
          variant: "destructive",
        });
        return;
      }

      try {
        await addBeneficiaryToContract(value as string);
      } catch (error) {
        return;
      }
    }

    setBeneficiaries((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );

    toast({
      title: "Beneficiary updated",
      description: `Beneficiary ${field} has been updated`,
    });
  };

  const getTotalPercentage = () => {
    return beneficiaries.reduce((sum, b) => sum + b.percentage, 0);
  };

  const addBeneficiaryToContract = async (beneficiaryAddress: string) => {
    console.log("Adding beneficiary:", beneficiaryAddress);
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to add a beneficiary",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(contractAddress, inheritanceABI, signer);

      const tx = await contract.addBeneficiary(beneficiaryAddress);
      await tx.wait();
      toast({
        title: "Beneficiary added",
        description: "Beneficiary has been added to your inheritance plan",
      });
    } catch (error) {
      console.error("Error adding beneficiary:", error);
      toast({
        title: "Error adding beneficiary",
        description: "There was an error adding the beneficiary to your plan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  const removeBeneficiaryFromContract = async (beneficiaryAddress: string) => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to remove a beneficiary",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const contract = new ethers.Contract(contractAddress, inheritanceABI);
      const tx = await contract.removeBeneficiary(beneficiaryAddress);
      await tx.wait();

      toast({
        title: "Beneficiary removed",
        description: "Beneficiary has been removed from your inheritance plan",
      });
    } catch (error) {
      console.error("Error removing beneficiary:", error);
      toast({
        title: "Error removing beneficiary",
        description:
          "There was an error removing the beneficiary from your plan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createInheritancePlan = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create an inheritance plan",
        variant: "destructive",
      });
      return;
    }

    const invalidAddresses = beneficiaries.filter(
      (b) => !ethers.isAddress(b.address)
    );
    if (invalidAddresses.length > 0) {
      toast({
        title: "Invalid wallet addresses",
        description: "One or more beneficiary wallet addresses are invalid",
        variant: "destructive",
      });
      return;
    }

    if (beneficiaries.length === 0) {
      toast({
        title: "No beneficiaries",
        description: "At least one beneficiary is required",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating inheritance plan...");
      setIsCreating(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress,
        inheritanceABI,
        signer
      );
      console.log("Contract instance:", contract);
      const timeoutPeriodSeconds = inactivityPeriod * 24 * 60 * 60;
      console.log("Timeout period in seconds:", timeoutPeriodSeconds);
      const beneficiaryAddresses = beneficiaries.map((b) => b.address);
      console.log("Beneficiary addresses:", beneficiaryAddresses);
      const valueInWei = ethers.parseEther(depositAmount);
      console.log("Deposit amount in wei:", valueInWei.toString());
      const tx = await contract.createInheritancePlan(
        beneficiaryAddresses,
        timeoutPeriodSeconds,
        { value: valueInWei }
      );
      console.log("Transaction hash:", tx.hash);
      await tx.wait();

      toast({
        title: "Inheritance plan created",
        description: "Your inheritance plan has been created successfully",
      });

      setShowCreateDialog(false);
      router.push("/");
    } catch (error) {
      console.error("Error creating inheritance plan:", error);
      toast({
        title: "Error creating plan",
        description: "There was an error creating your inheritance plan",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const saveBeneficiaries = () => {
    const total = getTotalPercentage();
    if (total !== 100) {
      toast({
        title: "Invalid allocation",
        description: `Total percentage must be 100%. Current total: ${total}%`,
        variant: "destructive",
      });
      return;
    }

    const invalidAddresses = beneficiaries.filter(
      (b) => !ethers.isAddress(b.address)
    );
    if (invalidAddresses.length > 0) {
      toast({
        title: "Invalid wallet addresses",
        description: "One or more beneficiary wallet addresses are invalid",
        variant: "destructive",
      });
      return;
    }

    if (planExists) {
      toast({
        title: "Updating beneficiaries",
        description: "Your inheritance plan is being updated",
      });
    } else {
      setShowCreateDialog(true);
    }
  };

  const downloadAgreement = () => {
    toast({
      title: "Agreement downloaded",
      description: "Your inheritance agreement has been downloaded",
    });
  };

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-6">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-8">
            Please connect your wallet to manage your beneficiaries
          </p>
          <Button
            onClick={connectWallet}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold mb-2">
            {planExists ? "Manage Beneficiaries" : "Create Inheritance Plan"}
          </h1>
          <p className="text-gray-400 mb-6">
            {planExists
              ? "Update who will receive your assets and how they will be distributed"
              : "Set up who will receive your assets and how they will be distributed"}
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-white/10">
              <TabsTrigger value="beneficiaries">Beneficiaries</TabsTrigger>
              <TabsTrigger value="settings">Inheritance Settings</TabsTrigger>
              <TabsTrigger value="documentation">Documentation</TabsTrigger>
            </TabsList>

            <TabsContent value="beneficiaries" className="mt-4 space-y-6">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Your Beneficiaries</CardTitle>
                    <CardDescription>
                      Add wallet addresses of your beneficiaries and allocate
                      percentages
                    </CardDescription>
                  </div>
                  <Button
                    onClick={addBeneficiary}
                    variant="outline"
                    size="icon"
                    className="rounded-full h-8 w-8 border-white/10"
                    disabled={beneficiaries.length >= 5}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add beneficiary</span>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {beneficiaries.map((beneficiary) => (
                      <div
                        key={beneficiary.id}
                        className="p-4 rounded-lg bg-gray-900/50 border border-white/5 space-y-4"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <User className="h-5 w-5 mr-2 text-purple-400" />
                            <Label
                              htmlFor={`name-${beneficiary.id}`}
                              className="sr-only"
                            >
                              Name
                            </Label>
                            <Input
                              id={`name-${beneficiary.id}`}
                              value={beneficiary.name}
                              onChange={(e) =>
                                updateBeneficiary(
                                  beneficiary.id,
                                  "name",
                                  e.target.value
                                )
                              }
                              className="h-7 bg-transparent border-none text-sm font-medium focus-visible:ring-0 p-0 w-auto"
                            />
                          </div>
                          {beneficiaries.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBeneficiary(beneficiary.id)}
                              className="h-7 w-7 text-gray-400 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`address-${beneficiary.id}`}>
                              Wallet Address
                            </Label>
                            <Input
                              id={`address-${beneficiary.id}`}
                              value={beneficiary.address}
                              onChange={(e) =>
                                updateBeneficiary(
                                  beneficiary.id,
                                  "address",
                                  e.target.value
                                )
                              }
                              placeholder="0x..."
                              className="bg-black/30 border-white/10"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label htmlFor={`percentage-${beneficiary.id}`}>
                                Allocation Percentage
                              </Label>
                              <span className="text-sm font-medium">
                                {beneficiary.percentage || 50}%
                              </span>
                            </div>
                            <Slider
                              id={`percentage-${beneficiary.id}`}
                              min={0}
                              max={100}
                              step={1}
                              value={[beneficiary.percentage || 50]}
                              onValueChange={(value) =>
                                updateBeneficiary(
                                  beneficiary.id,
                                  "percentage",
                                  value[0]
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`relationship-${beneficiary.id}`}>
                              Relationship
                            </Label>
                            <Select
                              value={beneficiary.relationship || 'Family'}
                              onValueChange={(value) =>
                                updateBeneficiary(
                                  beneficiary.id,
                                  "relationship",
                                  value
                                )
                              }
                            >
                              <SelectTrigger
                                id={`relationship-${beneficiary.id}`}
                                className="bg-black/30 border-white/10"
                              >
                                <SelectValue placeholder="Select relationship" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Family">Family</SelectItem>
                                <SelectItem value="Friend">Friend</SelectItem>
                                <SelectItem value="Partner">Partner</SelectItem>
                                <SelectItem value="Business">
                                  Business
                                </SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`email-${beneficiary.id}`}>
                              Contact Email (Optional)#TODO
                            </Label>
                            <Input
                              id={`email-${beneficiary.id}`}
                              value={beneficiary.email || ""}
                              onChange={(e) =>
                                updateBeneficiary(
                                  beneficiary.id,
                                  "email",
                                  e.target.value
                                )
                              }
                              placeholder="email@example.com"
                              className="bg-black/30 border-white/10"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`contact-${beneficiary.id}`}>
                            Additional Contact Info (Optional)
                          </Label>
                          <Input
                            id={`contact-${beneficiary.id}`}
                            value={beneficiary.contact || ""}
                            onChange={(e) =>
                              updateBeneficiary(
                                beneficiary.id,
                                "contact",
                                e.target.value
                              )
                            }
                            placeholder="Phone number or other contact details"
                            className="bg-black/30 border-white/10"
                          />
                        </div>
                      </div>
                    ))}

                    <div
                      className={`flex items-center p-3 rounded-lg ${getTotalPercentage() === 100
                        ? "bg-green-900/20 text-green-400"
                        : "bg-amber-900/20 text-amber-400"
                        }`}
                    >
                      <AlertCircle className="h-5 w-5 mr-2" />
                      <div className="text-sm">
                        Total allocation:{" "}
                        <span className="font-bold">
                          {getTotalPercentage()}%
                        </span>
                        {getTotalPercentage() !== 100 && " (must be 100%)"}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" asChild className="border-white/10">
                    <Link href="/">Cancel</Link>
                  </Button>
                  <Button
                    onClick={saveBeneficiaries}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : planExists ? (
                      "Update Beneficiaries"
                    ) : (
                      "Continue to Create Plan"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-4 space-y-6">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Inactivity Settings</CardTitle>
                  <CardDescription>
                    Define how long your account needs to be inactive before the
                    inheritance is triggered
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="inactivity">
                        Inactivity Period (Days)
                      </Label>
                      <span className="text-sm font-medium">
                        {inactivityPeriod} days
                      </span>
                    </div>
                    <Slider
                      id="inactivity"
                      min={30}
                      max={365}
                      step={1}
                      value={[inactivityPeriod]}
                      onValueChange={(value) => setInactivityPeriod(value[0])}
                      className="py-4"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>30 days</span>
                      <span>180 days</span>
                      <span>365 days</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-900/30">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-400">
                          How Inactivity Is Measured
                        </h4>
                        <p className="text-sm text-gray-300 mt-1">
                          Inactivity is measured from your last interaction with
                          the blockchain, including:
                        </p>
                        <ul className="text-sm text-gray-300 mt-2 space-y-1 list-disc list-inside">
                          <li>Logging into this platform</li>
                          <li>Making any transaction with your wallet</li>
                          <li>Manually resetting the inactivity timer</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-white/10" />

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      Notification Settings
                    </h3>

                    <div className="flex items-center justify-between space-x-2">
                      <Label
                        htmlFor="notifications"
                        className="flex items-center space-x-2"
                      >
                        <Clock className="h-4 w-4" />
                        <span>Email notifications before triggering</span>
                      </Label>
                      <Switch
                        id="notifications"
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>

                    {emailNotifications && (
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="notification-email">
                          Notification Email
                        </Label>
                        <Input
                          id="notification-email"
                          placeholder="your@email.com"
                          className="bg-black/30 border-white/10"
                        />
                        <p className="text-xs text-gray-400">
                          We'll send you reminders when your account is
                          approaching inactivity threshold
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    Save Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="documentation" className="mt-4 space-y-6">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Inheritance Documentation</CardTitle>
                  <CardDescription>
                    Review and download your inheritance agreement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5">
                    <div className="flex items-center mb-4">
                      <FileText className="h-6 w-6 text-purple-400 mr-2" />
                      <h3 className="text-lg font-medium">
                        Inheritance Agreement
                      </h3>
                    </div>

                    <div className="bg-black/30 rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-gray-300 mb-4">
                      <h4 className="font-medium mb-2">
                        CRYPTO INHERITANCE AGREEMENT
                      </h4>
                      <p className="mb-2">
                        This Crypto Inheritance Agreement ("Agreement") is
                        entered into by you ("Asset Owner") and is effective as
                        of the date of digital signature.
                      </p>

                      <h5 className="font-medium mt-4 mb-1">1. PURPOSE</h5>
                      <p className="mb-2">
                        This Agreement establishes the terms and conditions
                        under which your digital assets will be transferred to
                        your designated beneficiaries in the event of prolonged
                        inactivity.
                      </p>

                      <h5 className="font-medium mt-4 mb-1">
                        2. INACTIVITY PERIOD
                      </h5>
                      <p className="mb-2">
                        You have designated an inactivity period of{" "}
                        {inactivityPeriod} days. If you do not interact with the
                        platform or perform any blockchain transactions during
                        this period, the inheritance process will be triggered.
                      </p>

                      <h5 className="font-medium mt-4 mb-1">
                        3. BENEFICIARIES
                      </h5>
                      <p className="mb-2">
                        You have designated the following beneficiaries to
                        receive your digital assets:
                      </p>
                      <ul className="list-disc list-inside mb-2">
                        {beneficiaries.map((b) => (
                          <li key={b.id}>
                            {b.name} ({b.percentage}%) - Wallet:{" "}
                            {b.address || "Not specified"}
                          </li>
                        ))}
                      </ul>

                      <h5 className="font-medium mt-4 mb-1">
                        4. ASSET DISTRIBUTION
                      </h5>
                      <p className="mb-2">
                        Upon triggering of the inheritance process, your digital
                        assets will be distributed according to the percentages
                        specified above.
                      </p>

                      <h5 className="font-medium mt-4 mb-1">
                        5. LEGAL BINDING
                      </h5>
                      <p className="mb-2">
                        This Agreement is executed via blockchain smart contract
                        and constitutes a legally binding agreement in
                        jurisdictions where such digital agreements are
                        recognized.
                      </p>
                    </div>

                    <div className="flex items-center mb-4">
                      <Switch
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={setTermsAccepted}
                        className="mr-2"
                      />
                      <Label htmlFor="terms" className="text-sm">
                        I have read and agree to the terms of the inheritance
                        agreement
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      Educational Resources
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-purple-500/50 transition-colors">
                        <h4 className="font-medium mb-2">
                          Blockchain Inheritance Guide
                        </h4>
                        <p className="text-sm text-gray-400">
                          A comprehensive guide to understanding how blockchain
                          inheritance works.
                        </p>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm text-purple-400 mt-2"
                        >
                          Read Guide
                        </Button>
                      </div>

                      <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-blue-500/50 transition-colors">
                        <h4 className="font-medium mb-2">
                          Legal Considerations
                        </h4>
                        <p className="text-sm text-gray-400">
                          Important legal aspects of crypto inheritance in
                          different jurisdictions.
                        </p>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm text-blue-400 mt-2"
                        >
                          Learn More
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* Create Inheritance Plan Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-gray-950 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Create Inheritance Plan</DialogTitle>
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
                min="0.01"
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
                  <span className="text-gray-400">Inactivity Period:</span>
                  <span>{inactivityPeriod} days</span>
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
              onClick={createInheritancePlan}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={
                isCreating ||
                !depositAmount ||
                Number.parseFloat(depositAmount) <= 0
              }
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
