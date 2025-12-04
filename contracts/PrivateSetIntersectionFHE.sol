// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivateSetIntersectionFHE is SepoliaConfig {
    // state
    uint256 public setCount;
    mapping(address => uint256) public ownerToSetId;
    mapping(uint256 => EncryptedSet) public encryptedSets;
    mapping(uint256 => PSIRequest) private psiRequests;
    mapping(uint256 => bytes) public psiResults;
    
    // data
    struct EncryptedSet {
        uint256 id;
        address owner;
        bytes32[] items;
        uint256 timestamp;
    }
    
    struct PSIRequest {
        uint256 id;
        address requester;
        address[] participants;
        bool sizeOnly;
        uint256 timestamp;
    }
    
    // events
    event EncryptedSetSubmitted(uint256 indexed setId);
    event PSIRequested(uint256 indexed requestId);
    event PSIResultReceived(uint256 indexed requestId);
    
    modifier onlyOwnerOfSet(uint256 setId) {
        require(encryptedSets[setId].owner == msg.sender, "Not owner");
        _;
    }
    
    /// @notice submit encrypted items
    function submitEncryptedSet(bytes32[] memory items) external {
        setCount += 1;
        uint256 newId = setCount;
        
        EncryptedSet storage s = encryptedSets[newId];
        s.id = newId;
        s.owner = msg.sender;
        s.timestamp = block.timestamp;
        
        for (uint i = 0; i < items.length; i++) {
            s.items.push(items[i]);
        }
        
        ownerToSetId[msg.sender] = newId;
        emit EncryptedSetSubmitted(newId);
    }
    
    /// @notice request private set intersection for multiple participants
    function requestMultiPSI(address[] memory participants, bool sizeOnly) external returns (uint256) {
        require(participants.length >= 2, "Need >=2 participants");
        
        uint256 reqId = uint256(keccak256(abi.encodePacked(msg.sender, block.timestamp, participants)));
        PSIRequest storage r = psiRequests[reqId];
        r.id = reqId;
        r.requester = msg.sender;
        r.participants = participants;
        r.sizeOnly = sizeOnly;
        r.timestamp = block.timestamp;
        
        // gather ciphertext pointers for FHE computation
        // concatenate all participants' items as a flat bytes32 array
        uint totalItems = 0;
        for (uint i = 0; i < participants.length; i++) {
            uint256 sid = ownerToSetId[participants[i]];
            require(sid != 0, "Participant missing set");
            totalItems += encryptedSets[sid].items.length;
        }
        
        bytes32[] memory allCiphertexts = new bytes32[](totalItems);
        uint idx = 0;
        for (uint i = 0; i < participants.length; i++) {
            uint256 sid = ownerToSetId[participants[i]];
            bytes32[] storage items = encryptedSets[sid].items;
            for (uint j = 0; j < items.length; j++) {
                allCiphertexts[idx] = items[j];
                idx++;
            }
        }
        
        // ask FHE service to compute PSI or PSI size
        // selector will be used as the callback when computation completes
        uint256 fheReq = FHE.requestComputation(allCiphertexts, this.receivePSIResult.selector);
        // map fheReq to our reqId via simple storage trick
        psiRequests[fheReq] = r;
        
        emit PSIRequested(reqId);
        return reqId;
    }
    
    /// @notice callback for PSI computation result
    function receivePSIResult(uint256 requestId, bytes memory encryptedResult, bytes memory proof) public {
        // verify proof
        FHE.checkSignatures(requestId, encryptedResult, proof);
        
        // store encrypted result
        psiResults[requestId] = encryptedResult;
        
        emit PSIResultReceived(requestId);
    }
    
    /// @notice retrieve encrypted PSI result
    function getEncryptedPSIResult(uint256 requestId) external view returns (bytes memory) {
        return psiResults[requestId];
    }
    
    /// @notice helper to get participant set id
    function getSetId(address owner) external view returns (uint256) {
        return ownerToSetId[owner];
    }
    
    /// @notice helper to read an encrypted set's items
    function getEncryptedSetItems(uint256 setId) external view returns (bytes32[] memory) {
        return encryptedSets[setId].items;
    }
}