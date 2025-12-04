# PrivateSetIntersectionLibrary

A core cryptographic library that enables two or more participants to securely compute the intersection of their datasets without revealing any non-overlapping items. The system leverages Fully Homomorphic Encryption (FHE) to guarantee privacy during computation and supports both pairwise and multiparty private set intersection (PSI) operations.

## Project Background

In many collaborative scenarios, organizations need to find common data elements across multiple parties while preserving the confidentiality of individual datasets. Traditional approaches often expose sensitive information or require trusted intermediaries.

Challenges of existing solutions include:  

• Risk of data leakage when raw datasets are compared directly  

• Limited trust in third-party computation services  

• Lack of scalability for multiparty set operations  

• Insufficient cryptographic guarantees for enterprise or regulatory use cases  

PrivateSetIntersectionLibrary addresses these problems by providing a secure, efficient, and extensible cryptographic framework where:  

• Datasets are encrypted locally before being shared for computation  

• The intersection is computed using homomorphic encryption, ensuring no party learns non-overlapping items  

• Results can be returned as an encrypted set or simply as the size of the intersection  

• The protocol supports multiple parties without requiring a central trusted authority  

## Features

### Core Functionality

• Encrypted Dataset Upload: Each participant encrypts and uploads their dataset  

• FHE-Based Intersection: The protocol securely computes the common elements using homomorphic encryption  

• Flexible Results: Supports returning either the encrypted intersection itself or only its cardinality  

• Multiparty PSI: Extends beyond two-party scenarios to multiple participants  

### Privacy & Security

• Full Homomorphic Encryption (FHE): Ensures data remains encrypted during computation  

• Zero Knowledge of Non-Overlap: No participant learns information about non-intersecting elements  

• Secure Communication: Built-in gRPC communication channel for encrypted message exchange  

• Extensible Protocol: Designed for integration into broader privacy-preserving systems  

## Architecture

### Core Library

• Implements PSI protocol using TFHE-rs for homomorphic encryption  

• Provides modular APIs for dataset encryption, intersection computation, and result retrieval  

• Abstracts cryptographic details to simplify integration with higher-level applications  

### Service Layer

• gRPC-based communication for interoperability across distributed systems  

• Secure transport ensures end-to-end encryption of exchanged messages  

• Supports asynchronous multiparty computation flows  

## Technology Stack

• **Rust**: Core cryptographic implementation and performance-critical logic  

• **TFHE-rs**: Fully Homomorphic Encryption library for secure computation  

• **gRPC**: Communication layer for cross-platform service integration  

## Installation

### Prerequisites

• Rust (latest stable version)  

• Cargo package manager  

• Protobuf compiler (`protoc`) for gRPC  

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/PrivateSetIntersectionLibrary.git
cd PrivateSetIntersectionLibrary

# Build library
cargo build --release

# Run service (example)
cargo run --bin psi-service
```

## Usage

• **Dataset Preparation**: Encrypt each participant’s dataset locally using provided APIs  

• **Protocol Execution**: Initiate the PSI protocol between two or more parties via gRPC endpoints  

• **Result Retrieval**: Obtain the encrypted intersection set or its size depending on configuration  

• **Multiparty Extension**: Add more participants by extending the gRPC communication setup  

## Security Features

• FHE-based intersection guarantees no exposure of raw data  

• Communication encrypted with TLS over gRPC  

• Protocol resistant to inference attacks on non-overlapping items  

• Designed for regulatory-grade confidentiality requirements  

## Future Enhancements

• Optimized FHE schemes for reduced computational overhead  

• Support for threshold-based PSI results (alerts when intersection exceeds a limit)  

• Integration with secure enclaves (TEE) for hybrid computation models  

• Extended support for large-scale multiparty deployments  

• High-level SDKs for Python, Go, and JavaScript integration  

Built with 🔒 to enable privacy-preserving data collaboration across organizations.  
