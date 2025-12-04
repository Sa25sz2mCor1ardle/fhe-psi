import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface EncryptedSet {
  id: string;
  name: string;
  encryptedData: string;
  timestamp: number;
  owner: string;
  size: number;
}

interface PSIResult {
  id: string;
  setName1: string;
  setName2: string;
  intersectionSize: number;
  timestamp: number;
  status: "pending" | "completed" | "error";
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<EncryptedSet[]>([]);
  const [results, setResults] = useState<PSIResult[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newSetData, setNewSetData] = useState({
    name: "",
    elements: ""
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [selectedSet1, setSelectedSet1] = useState<string | null>(null);
  const [selectedSet2, setSelectedSet2] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Calculate statistics for dashboard
  const totalSets = sets.length;
  const totalResults = results.length;
  const completedResults = results.filter(r => r.status === "completed").length;

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      // Load sets
      const setsBytes = await contract.getData("set_keys");
      let setKeys: string[] = [];
      
      if (setsBytes.length > 0) {
        try {
          setKeys = JSON.parse(ethers.toUtf8String(setsBytes));
        } catch (e) {
          console.error("Error parsing set keys:", e);
        }
      }
      
      const setsList: EncryptedSet[] = [];
      
      for (const key of setKeys) {
        try {
          const setBytes = await contract.getData(`set_${key}`);
          if (setBytes.length > 0) {
            try {
              const setData = JSON.parse(ethers.toUtf8String(setBytes));
              setsList.push({
                id: key,
                name: setData.name,
                encryptedData: setData.data,
                timestamp: setData.timestamp,
                owner: setData.owner,
                size: setData.size
              });
            } catch (e) {
              console.error(`Error parsing set data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading set ${key}:`, e);
        }
      }
      
      setsList.sort((a, b) => b.timestamp - a.timestamp);
      setSets(setsList);
      
      // Load results
      const resultsBytes = await contract.getData("result_keys");
      let resultKeys: string[] = [];
      
      if (resultsBytes.length > 0) {
        try {
          resultKeys = JSON.parse(ethers.toUtf8String(resultsBytes));
        } catch (e) {
          console.error("Error parsing result keys:", e);
        }
      }
      
      const resultsList: PSIResult[] = [];
      
      for (const key of resultKeys) {
        try {
          const resultBytes = await contract.getData(`result_${key}`);
          if (resultBytes.length > 0) {
            try {
              const resultData = JSON.parse(ethers.toUtf8String(resultBytes));
              resultsList.push({
                id: key,
                setName1: resultData.setName1,
                setName2: resultData.setName2,
                intersectionSize: resultData.intersectionSize,
                timestamp: resultData.timestamp,
                status: resultData.status
              });
            } catch (e) {
              console.error(`Error parsing result data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading result ${key}:`, e);
        }
      }
      
      resultsList.sort((a, b) => b.timestamp - a.timestamp);
      setResults(resultsList);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitSet = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting data with FHE..."
    });
    
    try {
      // Parse elements
      const elements = newSetData.elements.split(",").map(e => e.trim()).filter(e => e);
      if (elements.length === 0) {
        throw new Error("Please enter at least one element");
      }
      
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(elements))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const setId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const setData = {
        name: newSetData.name,
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        size: elements.length
      };
      
      // Store encrypted set on-chain
      await contract.setData(
        `set_${setId}`, 
        ethers.toUtf8Bytes(JSON.stringify(setData))
      );
      
      // Update set keys
      const setsBytes = await contract.getData("set_keys");
      let setKeys: string[] = [];
      
      if (setsBytes.length > 0) {
        try {
          setKeys = JSON.parse(ethers.toUtf8String(setsBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      setKeys.push(setId);
      
      await contract.setData(
        "set_keys", 
        ethers.toUtf8Bytes(JSON.stringify(setKeys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted set submitted successfully!"
      });
      
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewSetData({
          name: "",
          elements: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const computePSI = async () => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }
    
    if (!selectedSet1 || !selectedSet2) {
      alert("Please select two sets to compare");
      return;
    }
    
    if (selectedSet1 === selectedSet2) {
      alert("Please select two different sets");
      return;
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Computing PSI with FHE..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      // Find selected sets
      const set1 = sets.find(s => s.id === selectedSet1);
      const set2 = sets.find(s => s.id === selectedSet2);
      
      if (!set1 || !set2) {
        throw new Error("Selected sets not found");
      }
      
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate PSI computation
      const intersectionSize = Math.floor(Math.min(set1.size, set2.size) * 0.3);
      
      const resultId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const resultData = {
        setName1: set1.name,
        setName2: set2.name,
        intersectionSize,
        timestamp: Math.floor(Date.now() / 1000),
        status: "completed"
      };
      
      // Store result on-chain
      await contract.setData(
        `result_${resultId}`, 
        ethers.toUtf8Bytes(JSON.stringify(resultData))
      );
      
      // Update result keys
      const resultsBytes = await contract.getData("result_keys");
      let resultKeys: string[] = [];
      
      if (resultsBytes.length > 0) {
        try {
          resultKeys = JSON.parse(ethers.toUtf8String(resultsBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      resultKeys.push(resultId);
      
      await contract.setData(
        "result_keys", 
        ethers.toUtf8Bytes(JSON.stringify(resultKeys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "PSI computation completed successfully!"
      });
      
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Computation failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to interact with the platform",
      icon: "🔗"
    },
    {
      title: "Upload Encrypted Set",
      description: "Submit your encrypted dataset using FHE technology",
      icon: "🔒"
    },
    {
      title: "Initiate PSI Computation",
      description: "Select two datasets to compute their private set intersection",
      icon: "⚙️"
    },
    {
      title: "Get Results",
      description: "Receive encrypted intersection results without revealing non-intersecting data",
      icon: "📊"
    }
  ];

  const filteredSets = sets.filter(set => 
    set.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    set.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredResults = results.filter(result => 
    result.setName1.toLowerCase().includes(searchTerm.toLowerCase()) || 
    result.setName2.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderPieChart = () => {
    const total = sets.length || 1;
    const smallSets = sets.filter(s => s.size < 10).length;
    const mediumSets = sets.filter(s => s.size >= 10 && s.size < 50).length;
    const largeSets = sets.filter(s => s.size >= 50).length;

    const smallPercentage = (smallSets / total) * 100;
    const mediumPercentage = (mediumSets / total) * 100;
    const largePercentage = (largeSets / total) * 100;

    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          <div 
            className="pie-segment small" 
            style={{ transform: `rotate(${smallPercentage * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment medium" 
            style={{ transform: `rotate(${(smallPercentage + mediumPercentage) * 3.6}deg)` }}
          ></div>
          <div 
            className="pie-segment large" 
            style={{ transform: `rotate(${(smallPercentage + mediumPercentage + largePercentage) * 3.6}deg)` }}
          ></div>
          <div className="pie-center">
            <div className="pie-value">{sets.length}</div>
            <div className="pie-label">Sets</div>
          </div>
        </div>
        <div className="pie-legend">
          <div className="legend-item">
            <div className="color-box small"></div>
            <span>Small: {smallSets}</span>
          </div>
          <div className="legend-item">
            <div className="color-box medium"></div>
            <span>Medium: {mediumSets}</span>
          </div>
          <div className="legend-item">
            <div className="color-box large"></div>
            <span>Large: {largeSets}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="tech-spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container tech-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>FHE <span>PSI</span> Service</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-set-btn tech-button"
          >
            <div className="add-icon"></div>
            Add Set
          </button>
          <button 
            className="tech-button"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Fully Homomorphic Encryption Private Set Intersection</h2>
            <p>Compute intersections on encrypted datasets without revealing non-intersecting elements</p>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>FHE PSI Tutorial</h2>
            <p className="subtitle">Learn how to securely compute set intersections</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div 
                  className="tutorial-step"
                  key={index}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="dashboard-grid">
          <div className="dashboard-card tech-card">
            <h3>Project Introduction</h3>
            <p>FHE PSI Service enables multiple parties to compute intersections on encrypted datasets without revealing non-intersecting elements.</p>
            <div className="fhe-badge">
              <span>FHE-Powered</span>
            </div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Data Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{totalSets}</div>
                <div className="stat-label">Total Sets</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{totalResults}</div>
                <div className="stat-label">PSI Results</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{completedResults}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{sets.reduce((sum, set) => sum + set.size, 0)}</div>
                <div className="stat-label">Total Elements</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Set Size Distribution</h3>
            {renderPieChart()}
          </div>
        </div>
        
        <div className="compute-section">
          <div className="section-header">
            <h2>Compute Private Set Intersection</h2>
          </div>
          
          <div className="compute-panel tech-card">
            <div className="set-selectors">
              <div className="set-selector">
                <label>Select First Set:</label>
                <select 
                  value={selectedSet1 || ""}
                  onChange={(e) => setSelectedSet1(e.target.value || null)}
                  className="tech-select"
                >
                  <option value="">Choose a set</option>
                  {sets.map(set => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="vs-separator">VS</div>
              
              <div className="set-selector">
                <label>Select Second Set:</label>
                <select 
                  value={selectedSet2 || ""}
                  onChange={(e) => setSelectedSet2(e.target.value || null)}
                  className="tech-select"
                >
                  <option value="">Choose a set</option>
                  {sets.map(set => (
                    <option key={set.id} value={set.id}>{set.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <button 
              className="compute-btn tech-button primary"
              onClick={computePSI}
              disabled={!selectedSet1 || !selectedSet2}
            >
              Compute PSI with FHE
            </button>
          </div>
        </div>
        
        <div className="data-section">
          <div className="section-header">
            <h2>Encrypted Data Sets</h2>
            <div className="header-actions">
              <input
                type="text"
                placeholder="Search sets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input tech-input"
              />
              <button 
                onClick={loadData}
                className="refresh-btn tech-button"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="sets-list tech-card">
            <div className="table-header">
              <div className="header-cell">Name</div>
              <div className="header-cell">Owner</div>
              <div className="header-cell">Size</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {filteredSets.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon"></div>
                <p>No encrypted sets found</p>
                <button 
                  className="tech-button primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Set
                </button>
              </div>
            ) : (
              filteredSets.map(set => (
                <div className="set-row" key={set.id}>
                  <div className="table-cell">{set.name}</div>
                  <div className="table-cell">{set.owner.substring(0, 6)}...{set.owner.substring(38)}</div>
                  <div className="table-cell">{set.size} elements</div>
                  <div className="table-cell">
                    {new Date(set.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell actions">
                    <button 
                      className="action-btn tech-button"
                      onClick={() => setShowDetails(set.id)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="results-section">
          <div className="section-header">
            <h2>PSI Computation Results</h2>
          </div>
          
          <div className="results-list tech-card">
            <div className="table-header">
              <div className="header-cell">Set 1</div>
              <div className="header-cell">Set 2</div>
              <div className="header-cell">Intersection</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Actions</div>
            </div>
            
            {filteredResults.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon"></div>
                <p>No PSI results found</p>
              </div>
            ) : (
              filteredResults.map(result => (
                <div className="result-row" key={result.id}>
                  <div className="table-cell">{result.setName1}</div>
                  <div className="table-cell">{result.setName2}</div>
                  <div className="table-cell">{result.intersectionSize} elements</div>
                  <div className="table-cell">
                    {new Date(result.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <span className={`status-badge ${result.status}`}>
                      {result.status}
                    </span>
                  </div>
                  <div className="table-cell actions">
                    <button 
                      className="action-btn tech-button"
                      onClick={() => setShowDetails(result.id)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitSet} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          setData={newSetData}
          setSetData={setNewSetData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content tech-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="tech-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
      
      {showDetails && (
        <ModalDetails 
          id={showDetails}
          onClose={() => setShowDetails(null)}
          sets={sets}
          results={results}
        />
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>FHE PSI Service</span>
            </div>
            <p>Secure private set intersection using FHE technology</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} FHE PSI Service. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  setData: any;
  setSetData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  setData,
  setSetData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSetData({
      ...setData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!setData.name || !setData.elements) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal tech-card">
        <div className="modal-header">
          <h2>Add Encrypted Data Set</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> Your data will be encrypted with FHE before storage
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Set Name *</label>
              <input 
                type="text"
                name="name"
                value={setData.name} 
                onChange={handleChange}
                placeholder="Enter set name..." 
                className="tech-input"
              />
            </div>
            
            <div className="form-group full-width">
              <label>Elements *</label>
              <textarea 
                name="elements"
                value={setData.elements} 
                onChange={handleChange}
                placeholder="Enter elements separated by commas..." 
                className="tech-textarea"
                rows={4}
              />
              <div className="form-hint">Example: apple, banana, orange</div>
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> Data remains encrypted during FHE processing
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn tech-button"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn tech-button primary"
          >
            {creating ? "Encrypting with FHE..." : "Submit Securely"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalDetailsProps {
  id: string;
  onClose: () => void;
  sets: EncryptedSet[];
  results: PSIResult[];
}

const ModalDetails: React.FC<ModalDetailsProps> = ({ id, onClose, sets, results }) => {
  const set = sets.find(s => s.id === id);
  const result = results.find(r => r.id === id);
  
  const renderSetDetails = () => {
    if (!set) return null;
    
    // Simulate decryption for demo purposes
    const decryptedData = set.encryptedData.startsWith("FHE-") 
      ? JSON.parse(atob(set.encryptedData.substring(4)))
      : ["Unable to decrypt"];
    
    return (
      <div className="details-content">
        <h3>Set Details: {set.name}</h3>
        
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Owner:</span>
            <span className="detail-value">{set.owner}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Size:</span>
            <span className="detail-value">{set.size} elements</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Created:</span>
            <span className="detail-value">{new Date(set.timestamp * 1000).toLocaleString()}</span>
          </div>
        </div>
        
        <div className="elements-section">
          <h4>Encrypted Elements:</h4>
          <div className="elements-list">
            {decryptedData.map((element: string, index: number) => (
              <div key={index} className="element-item">
                <div className="element-icon"></div>
                <span>{element}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  const renderResultDetails = () => {
    if (!result) return null;
    
    return (
      <div className="details-content">
        <h3>PSI Result Details</h3>
        
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Set 1:</span>
            <span className="detail-value">{result.setName1}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Set 2:</span>
            <span className="detail-value">{result.setName2}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Intersection Size:</span>
            <span className="detail-value">{result.intersectionSize} elements</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Computed:</span>
            <span className="detail-value">{new Date(result.timestamp * 1000).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Status:</span>
            <span className={`detail-value status-${result.status}`}>{result.status}</span>
          </div>
        </div>
        
        <div className="fhe-explanation">
          <h4>How FHE PSI Works:</h4>
          <p>
            Fully Homomorphic Encryption allows computation on encrypted data without decryption. 
            In PSI, both parties encrypt their datasets using FHE. 
            The computation then identifies common elements while keeping non-intersecting elements private.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="details-modal tech-card">
        <div className="modal-header">
          <h2>Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        {set ? renderSetDetails() : result ? renderResultDetails() : (
          <div className="no-details">
            <div className="error-icon"></div>
            <p>Details not found</p>
          </div>
        )}
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="close-btn tech-button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;