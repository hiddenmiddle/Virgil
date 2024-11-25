import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCRp3so36_GSz9wCCOkVIF1DJtWvw6GVxQ",
    authDomain: "virgil-110a0.firebaseapp.com",
    databaseURL: "https://virgil-110a0-default-rtdb.firebaseio.com",
    projectId: "virgil-110a0",
    storageBucket: "virgil-110a0.firebasestorage.app",
    messagingSenderId: "190590960966",
    appId: "1:190590960966:web:e4228bff5827fb67dc5147",
    measurementId: "G-8K3768MNTS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const functions = getFunctions(app);

// Get DOM elements
const textarea = document.querySelector('textarea');
const clientDropdown = document.querySelector('.dropdown:nth-child(1) .dropdown-content');
const sessionDropdown = document.querySelector('.dropdown:nth-child(2) .dropdown-content');
const clientButton = document.querySelector('.dropdown:nth-child(1) .dropbtn');
const sessionButton = document.querySelector('.dropdown:nth-child(2) .dropbtn');
const createBtn = document.getElementById('createBtn');

let selectedClient = null;
let selectedSession = null;

// Handle client selection
clientDropdown.addEventListener('click', async (e) => {
    if (e.target.tagName === 'A') {
        if (e.target.textContent === 'New') {
            const newClient = prompt('Enter new client ID:');
            if (newClient) {
                selectedClient = newClient;
                clientButton.textContent = newClient;
                // Clear and reset session dropdown
                sessionButton.textContent = 'Session';
                while (sessionDropdown.children.length > 1) {
                    sessionDropdown.removeChild(sessionDropdown.lastChild);
                }
                selectedSession = '1'; // Default to session 1 for new client
                sessionButton.textContent = 'Session 1';
            }
        } else {
            selectedClient = e.target.textContent;
            clientButton.textContent = e.target.textContent;
            loadSessions(selectedClient);
        }
    }
});

// Handle session selection
sessionDropdown.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
        if (e.target.textContent === 'New') {
            const lastSession = Array.from(sessionDropdown.children)
                .filter(a => a.textContent !== 'New')
                .length;
            selectedSession = (lastSession + 1).toString();
            sessionButton.textContent = `Session ${selectedSession}`;
        } else {
            sessionButton.textContent = e.target.textContent;
            selectedSession = e.target.textContent.split(' ')[1];
        }
    }
});

// Load existing clients
function loadClients() {
    console.log('Loading clients...');  // Debug log
    const dbRef = ref(database, 'conceptualizations');
    onValue(dbRef, (snapshot) => {
        const clients = snapshot.val() || {};
        console.log('Loaded clients:', clients);  // Debug log
        
        // Clear existing options except "New"
        while (clientDropdown.children.length > 1) {
            clientDropdown.removeChild(clientDropdown.lastChild);
        }
        
        // Add client options
        Object.keys(clients).forEach(clientId => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = clientId;
            a.onclick = () => loadSessions(clientId);
            clientDropdown.appendChild(a);
        });
    });
}

// Load sessions for selected client
function loadSessions(clientId) {
    const dbRef = ref(database, `conceptualizations/${clientId}/sessions`);
    onValue(dbRef, (snapshot) => {
        const sessions = snapshot.val() || {};
        
        // Clear existing options except "New"
        while (sessionDropdown.children.length > 1) {
            sessionDropdown.removeChild(sessionDropdown.lastChild);
        }
        
        // Add session options
        Object.keys(sessions).forEach(sessionNum => {
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = `Session ${sessionNum}`;
            a.onclick = () => loadGraph(clientId, sessionNum);
            sessionDropdown.appendChild(a);
        });
    });
}

// Create new conceptualization
createBtn.onclick = async () => {
    const conversation = textarea.value;
    
    if (!conversation || !selectedClient || !selectedSession) {
        alert('Please fill in all fields (conversation, client, and session)');
        return;
    }
    
    try {
        const graphContainer = document.getElementById('graph-container');
        graphContainer.innerHTML = '<div class="loading">Processing...</div>';
        
        const createFunction = httpsCallable(functions, 'create_pbt_conceptualization');
        await createFunction({
            conversation,
            clientId: selectedClient,
            sessionNumber: selectedSession
        });
        
        // Listen for changes to the analysis status
        const statusRef = ref(database, `conceptualizations/${selectedClient}/sessions/${selectedSession}`);
        onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            switch(data.status) {
                case 'completed':
                    visualizeGraph({
                        nodes: data.nodes,
                        links: data.edges.map(edge => ({
                            source: edge.from,
                            target: edge.to,
                            importance: edge.strength,
                            bidirectional: edge.bidirectional
                        }))
                    });
                    break;
                    
                case 'error':
                    graphContainer.innerHTML = `<div class="error">Error: ${data.error_message}</div>`;
                    break;
            }
        });
        
    } catch (error) {
        console.error('Detailed error:', error);
        document.getElementById('graph-container').innerHTML = 
            `<div class="error">Error: ${error.message}</div>`;
    }
};

// Visualize graph using Mermaid.js
function visualizeGraph(data) {
    const container = document.getElementById('graph-container');
    container.innerHTML = '';
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.style.width = '100%';
    wrapperDiv.style.height = '80vh';
    wrapperDiv.style.overflow = 'hidden';
    wrapperDiv.style.position = 'relative';
    container.appendChild(wrapperDiv);
    
    const mermaidDiv = document.createElement('div');
    mermaidDiv.className = 'mermaid';
    wrapperDiv.appendChild(mermaidDiv);
    
    let mermaidCode = `flowchart LR\n`;
    
    // Define styles with Russian translations
    const styles = {
        'Процессы внимания': 'fill:#FF6B6B',
        'Когнитивная сфера': 'fill:#4ECDC4',
        'Аффективная сфера': 'fill:#45B7D1',
        'Самость': 'fill:#96CEB4',
        'Мотивация': 'fill:#FFEEAD',
        'Поведение': 'fill:#D4A5A5',
        'Биофизиологический контекст': 'fill:#9FA8DA',
        'Ситуационный контекст': 'fill:#FFD93D',
        'Личная история': 'fill:#95A5A6',
        'Социокультурный и экономический контекст': 'fill:#BDC3C7'
    };
    
    // Add legend as a subgraph with correct syntax
    mermaidCode += '\n    subgraph Легенда\n        direction TB\n';
    Object.entries(styles).forEach(([category, style], index) => {
        mermaidCode += `        leg${index}["${category}"]\n`;
        mermaidCode += `        style leg${index} ${style},font-size:12px\n`;
        if (index < Object.entries(styles).length - 1) {
            mermaidCode += `        leg${index} --- leg${index + 1}\n`;
            mermaidCode += `        linkStyle ${index} stroke:none\n`;
        }
    });
    mermaidCode += '    end\n\n';
    
    // Add nodes with increased spacing from legend
    data.nodes.forEach(node => {
        mermaidCode += `    ${node.id}["${node.label}"]\n`;
        mermaidCode += `    style ${node.id} ${styles[getCategoryInRussian(node.category)]},font-size:14px\n`;
    });
    
    // Add connections
    const linkStartIndex = Object.entries(styles).length;
    data.links.forEach((link, index) => {
        if (link.bidirectional) {
            mermaidCode += `    ${link.source} <--> ${link.target}\n`;
        } else {
            mermaidCode += `    ${link.source} --> ${link.target}\n`;
        }
        mermaidCode += `    linkStyle ${index + linkStartIndex} stroke-width:${link.importance}px\n`;
    });
    
    // Set content
    mermaidDiv.textContent = mermaidCode;
    
    // Configure Mermaid with adjusted spacing
    mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 100,  // Increased spacing
            rankSpacing: 120,  // Increased spacing
            fontSize: 14,
            diagramPadding: 20
        }
    });

    // Update CSS for legend positioning
    const style = document.createElement('style');
    style.textContent = `
        .mermaid {
            width: 100%;
            height: 100%;
            cursor: move;
        }
        .mermaid svg {
            width: 100% !important;
            height: 100% !important;
            transform-origin: 50% 50%;
        }
        .Легенда {
            transform: translateX(-50px);
        }
    `;
    document.head.appendChild(style);

    // Render and add zoom/pan with initial scale adjustment
    mermaid.run().then(() => {
        const svg = wrapperDiv.querySelector('svg');
        if (!svg) return;

        // Calculate initial scale to fit the content
        const svgBBox = svg.getBBox();
        const containerWidth = wrapperDiv.clientWidth;
        const containerHeight = wrapperDiv.clientHeight;
        const scaleX = containerWidth / (svgBBox.width + 100);  // Add padding
        const scaleY = containerHeight / (svgBBox.height + 100);
        const initialScale = Math.min(scaleX, scaleY, 1);  // Don't scale up, only down if needed

        let zoom = initialScale;
        const zoomSpeed = 0.1;
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;

        // Initial transform to fit content
        updateTransform();

        // Rest of the event listeners...
        wrapperDiv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            zoom = Math.max(0.1, Math.min(2, zoom + delta));
            updateTransform();
        });

        wrapperDiv.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                e.preventDefault();
                isDragging = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
            }
        });

        wrapperDiv.addEventListener('mousemove', (e) => {
            if (isDragging) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        });

        wrapperDiv.addEventListener('mouseup', () => {
            isDragging = false;
        });

        wrapperDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        function updateTransform() {
            svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoom})`;
        }
    });
}

// Helper function to translate categories to Russian
function getCategoryInRussian(category) {
    const translations = {
        'Attentional processes': 'Процессы внимания',
        'Cognitive sphere': 'Когнитивная сфера',
        'Affective sphere': 'Аффективная сфера',
        'Selfing': 'Самость',
        'Motivation': 'Мотивация',
        'Overt behavior': 'Поведение',
        'Biophysiological context': 'Биофизиологический контекст',
        'Situational context': 'Ситуационный контекст',
        'Personal history': 'Личная история',
        'Broader socio-cultural and economical context': 'Социокультурный и экономический контекст'
    };
    return translations[category] || category;
}

// Load initial data
loadClients();

// Add missing utility functions
function getCategoryColor(category) {
    const colors = {
        'Attentional processes': '#FF6B6B',
        'Cognitive sphere': '#4ECDC4',
        'Affective sphere': '#45B7D1',
        'Selfing': '#96CEB4',
        'Motivation': '#FFEEAD',
        'Overt behavior': '#D4A5A5',
        'Biophysiological context': '#9FA8DA',
        'Situational context': '#FFD93D',
        'Personal history': '#95A5A6',
        'Broader socio-cultural and economical context': '#BDC3C7'
    };
    return colors[category] || '#ddd';
}

function wrap(text, width) {
    text.each(function() {
        let text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            y = text.attr("y"),
            dy = parseFloat(text.attr("dy")) || 0,
            tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
            
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
}

// Update loadGraph function to load from database
function loadGraph(clientId, sessionNum) {
    const graphRef = ref(database, `conceptualizations/${clientId}/sessions/${sessionNum}`);
    onValue(graphRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.status === 'completed') {
            visualizeGraph({
                nodes: data.nodes,
                links: data.edges.map(edge => ({
                    source: edge.from,
                    target: edge.to,
                    importance: edge.strength
                }))
            });
        }
    });
}

// Add some CSS for the loading and error states
const style = document.createElement('style');
style.textContent = `
    .loading {
        text-align: center;
        padding: 20px;
        color: #666;
    }
    
    .error {
        text-align: center;
        padding: 20px;
        color: #ff4444;
    }
`;
document.head.appendChild(style);
