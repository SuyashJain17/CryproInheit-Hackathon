"use client"

import { ethers } from "ethers";
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  Search,
  Shield,
  Upload,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { inheritanceABI } from "@/lib/abis/InheritanceContract";

// No claims exist currently
const mockClaims: any[] = [];

// Helper function to format dates
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

// Helper function to format addresses
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Helper function to calculate total value
const calculateTotalValue = (assets: any[]) => {
  return assets.reduce((total, asset) => total + asset.value, 0)
}

// Helper function to validate Ethereum address
const isValidAddress = (address: string) => {
  return ethers.isAddress(address)
}

// Custom Toaster Component
interface ToasterMessage {
  id: number;
  title: string;
  description: string;
  variant: 'success' | 'error' | 'info';
}

const CustomToaster = ({ messages, removeMessage }: { messages: ToasterMessage[], removeMessage: (id: number) => void }) => {
  return (
    <div className="fixed top-4 right-4 space-y-2">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
            className={`
              p-4 rounded-lg shadow-lg border z-50
              ${message.variant === 'success' ? 'bg-green-900/80 border-green-500/50 text-green-100' : ''}
              ${message.variant === 'error' ? 'bg-red-900/80 border-red-500/50 text-red-100' : ''}
              ${message.variant === 'info' ? 'bg-blue-900/80 border-blue-500/50 text-blue-100' : ''}
              max-w-sm
            `}
          >
            <div className="flex items-start gap-2 z-50">
              {message.variant === 'success' && <CheckCircle2 className="h-5 w-5 mt-0.5" />}
              {message.variant === 'error' && <XCircle className="h-5 w-5 mt-0.5" />}
              {message.variant === 'info' && <AlertCircle className="h-5 w-5 mt-0.5" />}
              <div>
                <h4 className="font-semibold">{message.title}</h4>
                <p className="text-sm">{message.description}</p>
                {message.variant === 'success' && message.description.includes('Transaction confirmed') && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-xs text-blue-400 mt-1"
                    asChild
                  >
                    <Link href={`https://arbiscan.io/tx/${message.description.split(': ')[1]}`} target="_blank">
                      View on Arbiscan
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default function ClaimsPage() {
  const { address, connectWallet } = useWallet()
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClaim, setSelectedClaim] = useState<any>(null)
  const [showClaimDetails, setShowClaimDetails] = useState(false)
  const [showNewClaimDialog, setShowNewClaimDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toasterMessages, setToasterMessages] = useState<ToasterMessage[]>([])

  // New claim form state
  const [newClaimForm, setNewClaimForm] = useState({
    deceasedAddress: "",
    claimantAddress: "",
    relationship: "",
    assetType: "ETH",
    assetAmount: "",
    evidence: "",
    contactEmail: "",
    additionalInfo: "",
  })

  // Function to add a toaster message
  const addToasterMessage = (title: string, description: string, variant: 'success' | 'error' | 'info') => {
    const id = Date.now()
    setToasterMessages((prev) => [...prev, { id, title, description, variant }])

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeToasterMessage(id)
    }, 5000)
  }

  // Function to remove a toaster message
  const removeToasterMessage = (id: number) => {
    setToasterMessages((prev) => prev.filter((msg) => msg.id !== id))
  }

  // Function to handle new claim form changes
  const handleNewClaimFormChange = (field: string, value: string) => {
    setNewClaimForm({
      ...newClaimForm,
      [field]: value,
    })
  }

  // Function to submit new claim
  const submitNewClaim = async () => {
    try {
      setIsSubmitting(true)

      // Validate required fields
      if (
        !newClaimForm.deceasedAddress ||
        !newClaimForm.relationship ||
        !newClaimForm.assetType ||
        !newClaimForm.assetAmount
      ) {
        throw new Error("Missing required fields: Please fill in all required fields")
      }

      // Validate Ethereum addresses
      if (!isValidAddress(newClaimForm.deceasedAddress)) {
        throw new Error("Invalid deceased wallet address: Please enter a valid Ethereum address")
      }

      if (newClaimForm.claimantAddress && !isValidAddress(newClaimForm.claimantAddress)) {
        throw new Error("Invalid claimant wallet address: Please enter a valid Ethereum address")
      }

      // Validate email format
      if (newClaimForm.contactEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(newClaimForm.contactEmail)) {
          throw new Error("Invalid email: Please enter a valid email address")
        }
      }

      // Check if wallet is available
      if (!window.ethereum) {
        throw new Error("Wallet not found: Please install MetaMask or another Ethereum wallet")
      }

      // Connect wallet if not connected
      if (!address) {
        await connectWallet()
      }


      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      // Verify network (Arbitrum One, chainId 42161)
      const network = await provider.getNetwork()
      if (network.chainId !== BigInt(42161)) {
        throw new Error("Wrong network: Please switch to Arbitrum One")
      }

      const contractAddress = "0xbc3dCfD875126879E7e2286c328eBb26725aC44B"
      const contract = new ethers.Contract(contractAddress, inheritanceABI, signer)

      // Verify contract is deployed
      const code = await provider.getCode(contractAddress)
      if (code === '0x') {
        throw new Error("Contract error: Smart contract not found at the specified address")
      }

      // Send transaction
      const tx = await contract.redeem(newClaimForm.deceasedAddress, {
        gasLimit: 300000,
      })

      // Wait for transaction confirmation
      const receipt = await tx.wait()

      addToasterMessage(
        "Claim successful",
        `Transaction confirmed: ${receipt.hash}`,
        "success"
      )

      setShowNewClaimDialog(false)
      setNewClaimForm({
        deceasedAddress: "",
        claimantAddress: "",
        relationship: "",
        assetType: "ETH",
        assetAmount: "",
        evidence: "",
        contactEmail: "",
        additionalInfo: "",
      })
    } catch (error: any) {
      console.error("Error submitting claim:", error)
      let errorMessage = error.message || "An error occurred while processing your claim"

      if (error.code === 4001) {
        errorMessage = "Transaction rejected by user"
      } else {
        errorMessage = "Transaction failed: The owner has already been verified, and the claim cannot be processed again"
      }

      addToasterMessage(
        "Claim failed",
        errorMessage,
        "error"
      )
      throw new Error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    addToasterMessage(
      "Copied to clipboard",
      "The text has been copied to your clipboard",
      "success"
    )
  }

  const viewClaimDetails = (claim: any) => {
    setSelectedClaim(claim)
    setShowClaimDetails(true)
  }

  const filteredClaims = mockClaims.filter((claim) => {
    if (activeTab !== "all" && claim.status !== activeTab) {
      return false
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        claim.id.toLowerCase().includes(query) ||
        claim.claimant.toLowerCase().includes(query) ||
        claim.claimantName.toLowerCase().includes(query) ||
        claim.deceased.toLowerCase().includes(query) ||
        claim.deceasedName.toLowerCase().includes(query)
      )
    }

    return true
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="outline" className="border-green-500 text-green-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="border-red-500 text-red-400 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-500 text-gray-400">
            Unknown
          </Badge>
        )
    }
  }

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-6">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-8">Please connect your wallet to view claims</p>
          <Button onClick={connectWallet} className="bg-gradient-to-r from-purple-600 to-blue-600">
            Connect Wallet
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 relative z-99">
      <CustomToaster messages={toasterMessages} removeMessage={removeToasterMessage} />
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold mb-2">Claims on Inherited Crypto Assets</h1>
          <p className="text-gray-400 mb-6">
            View and manage inheritance claims for digital assets. Our secure verification process ensures that only
            legitimate beneficiaries receive their entitled assets.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
        >
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search claims..."
              className="pl-9 bg-black/30 border-white/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="sm"
              onClick={() => setShowNewClaimDialog(true)}
            >
              Make New Claim
            </Button>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-black/40 border border-white/10">
              <TabsTrigger value="all">All Claims</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="verified">Verified</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Claim Records</CardTitle>
                  <CardDescription>
                    {filteredClaims.length} claims found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead>Claim ID</TableHead>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                            No claims exist currently
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-black/40 border border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-purple-500/50 transition-colors">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-purple-400" />
                    Claim Verification
                  </h3>
                  <p className="text-sm text-gray-400">
                    Learn how our verification process works to ensure secure and legitimate inheritance claims.
                  </p>
                  <Button variant="link" className="p-0 h-auto text-sm text-purple-400 mt-2">
                    Read More
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-blue-500/50 transition-colors">
                  <h3 className="font-medium mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2 text-blue-400" />
                    Dispute Resolution
                  </h3>
                  <p className="text-sm text-gray-400">
                    Understanding the process for resolving disputes over inheritance claims.
                  </p>
                  <Button variant="link" className="p-0 h-auto text-sm text-blue-400 mt-2">
                    Learn More
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-gray-900/50 border border-white/5 hover:border-cyan-500/50 transition-colors">
                  <h3 className="font-medium mb-2 flex items-center">
                    <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                    Next Steps
                  </h3>
                  <p className="text-sm text-gray-400">
                    What to do after your claim has been verified and how to access your inherited assets.
                  </p>
                  <Button variant="link" className="p-0 h-auto text-sm text-blue-400 mt-2">
                    View Guide
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-white/10 mt-4 pt-4 text-center text-gray-400 italic">
              "Inheritance should be seamless, even in the decentralized world."
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>

      <Dialog open={showNewClaimDialog} onOpenChange={setShowNewClaimDialog}>
        <DialogContent className="bg-black/90 border border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Inheritance Claim</DialogTitle>
            <DialogDescription>Submit a claim for assets you believe you are entitled to inherit</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deceased-address">Deceased Wallet Address</Label>
              <Input
                id="deceased-address"
                placeholder="0x..."
                className="bg-black/30 border-white/10"
                value={newClaimForm.deceasedAddress}
                onChange={(e) => handleNewClaimFormChange("deceasedAddress", e.target.value)}
              />
              <p className="text-xs text-gray-400">Enter the wallet address of the deceased person</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="claimant-address">Your Wallet Address</Label>
              <Input
                id="claimant-address"
                placeholder="0x..."
                className="bg-black/30 border-white/10"
                value={newClaimForm.claimantAddress}
                onChange={(e) => handleNewClaimFormChange("claimantAddress", e.target.value)}
              />
              <p className="text-xs text-gray-400">Enter your wallet address</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship to Deceased</Label>
              <Select
                value={newClaimForm.relationship}
                onValueChange={(value) => handleNewClaimFormChange("relationship", value)}
              >
                <SelectTrigger id="relationship" className="bg-black/30 border-white/10">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="family">Family Member</SelectItem>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="business">Business Partner</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-amount">Asset Amount</Label>
              <Input
                id="asset-amount"
                placeholder="Enter amount"
                type="number"
                className="bg-black/30 border-white/10"
                value={newClaimForm.assetAmount}
                onChange={(e) => handleNewClaimFormChange("assetAmount", e.target.value)}
              />
              <p className="text-xs text-gray-400">Enter the amount of assets you're claiming</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">Contact Email</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="your@email.com"
                className="bg-black/30 border-white/10"
                value={newClaimForm.contactEmail}
                onChange={(e) => handleNewClaimFormChange("contactEmail", e.target.value)}
              />
              <p className="text-xs text-gray-400">We'll use this to contact you about your claim</p>
            </div>


          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewClaimDialog(false)}
              className="border-white/10"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              onClick={submitNewClaim}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClaimDetails} onOpenChange={setShowClaimDetails}>
        <DialogContent className="bg-black/90 border border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
            <DialogDescription>Detailed information about the selected inheritance claim</DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400">Claim ID</Label>
                  <div className="flex items-center">
                    <div className="font-mono text-xs bg-black/50 p-2 rounded border border-white/10 flex-1 overflow-hidden text-ellipsis">
                      {selectedClaim.id}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1"
                      onClick={() => copyToClipboard(selectedClaim.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400">Status</Label>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(selectedClaim.status)}
                    {selectedClaim.status === "verified" && (
                      <span className="text-xs text-gray-400">on {formatDate(selectedClaim.verificationDate)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400">Claimant</Label>
                  <div>
                    <div className="font-medium">{selectedClaim.claimantName}</div>
                    <div className="font-mono text-xs text-gray-400">{selectedClaim.claimant}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400">Deceased</Label>
                  <div>
                    <div className="font-medium">{selectedClaim.deceasedName}</div>
                    <div className="font-mono text-xs text-gray-400">{selectedClaim.deceased}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400">Claimed Assets</Label>
                <div className="bg-black/50 rounded-lg border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead>Asset</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Value (USD)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedClaim.assets.map((asset: any, index: number) => (
                        <TableRow key={index} className="border-white/10">
                          <TableCell>
                            {asset.type}
                            {asset.tokenId && ` ${asset.tokenId}`}
                            {asset.collection && <div className="text-xs text-gray-400">{asset.collection}</div>}
                          </TableCell>
                          <TableCell>{asset.amount}</TableCell>
                          <TableCell className="text-right">${asset.value.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-white/10 bg-gray-900/30">
                        <TableCell colSpan={2} className="font-medium">
                          Total Value
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${calculateTotalValue(selectedClaim.assets).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedClaim.status === "verified" && selectedClaim.transactionHash && (
                <div className="space-y-2">
                  <Label className="text-gray-400">Transaction Hash</Label>
                  <div className="flex items-center">
                    <div className="font-mono text-xs bg-black/50 p-2 rounded border border-white/10 flex-1 overflow-hidden text-ellipsis">
                      {selectedClaim.transactionHash}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-1"
                      onClick={() => copyToClipboard(selectedClaim.transactionHash)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="ml-1" asChild>
                      <Link href={`https://arbiscan.io/tx/${selectedClaim.transactionHash}`} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {selectedClaim.status === "rejected" && selectedClaim.rejectionReason && (
                <div className="space-y-2">
                  <Label className="text-gray-400">Rejection Reason</Label>
                  <div className="bg-red-900/20 border border-red-900/30 p-3 rounded-lg text-sm">
                    {selectedClaim.rejectionReason}
                  </div>
                </div>
              )}

              {selectedClaim.status === "pending" && (
                <div className="bg-amber-900/20 border border-amber-900/30 p-3 rounded-lg text-sm">
                  <div className="flex items-start">
                    <Clock className="h-5 w-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-amber-400">Claim Under Review</h4>
                      <p className="text-gray-300 mt-1">
                        This claim is currently being reviewed by our verification system. This process typically takes
                        3-5 business days.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {selectedClaim && selectedClaim.status === "pending" && (
              <Button variant="destructive" className="sm:mr-auto">
                Cancel Claim
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowClaimDetails(false)} className="border-white/10">
              Close
            </Button>
            {selectedClaim && selectedClaim.status === "verified" && (
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                Access Assets
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}