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
    // Clear and set up main container
    const container = document.getElementById('graph-container');
    container.style.position = 'relative';
    container.style.display = 'flex';
    container.style.height = 'calc(100vh - 200px)'; // Adjust based on your header height
    container.style.margin = '20px';
    container.style.backgroundColor = 'white';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
    container.innerHTML = '';
    
    // Define styles with Russian translations
    const styles = {
        'Процессы внимания': '#FF6B6B',
        'Когнитивная сфера': '#4ECDC4',
        'Аффективная сфера': '#45B7D1',
        'Самость': '#96CEB4',
        'Мотивация': '#FFEEAD',
        'Поведение': '#D4A5A5',
        'Биофизиологический контекст': '#9FA8DA',
        'Ситуационный контекст': '#FFD93D',
        'Личная история': '#95A5A6',
        'Социокультурный и экономический контекст': '#BDC3C7'
    };

    // Create and style legend container
    const legendDiv = document.createElement('div');
    legendDiv.style.width = '200px';
    legendDiv.style.padding = '20px';
    legendDiv.style.borderRight = '1px solid #ddd';
    legendDiv.style.overflowY = 'auto';
    container.appendChild(legendDiv);

    // Add legend items
    Object.entries(styles).forEach(([category, color]) => {
        const legendItem = document.createElement('div');
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'flex-start';
        legendItem.style.gap = '10px';
        legendItem.style.marginBottom = '8px';

        const colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = color;
        colorBox.style.borderRadius = '4px';
        colorBox.style.flexShrink = '0';

        const label = document.createElement('div');
        label.style.fontSize = '14px';
        label.style.lineHeight = '1.3';
        label.textContent = category;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendDiv.appendChild(legendItem);
    });

    // Create graph container
    const graphContainer = document.createElement('div');
    graphContainer.style.flex = '1';
    graphContainer.style.position = 'relative';
    graphContainer.style.minHeight = '500px'; // Ensure minimum height
    graphContainer.style.padding = '20px';
    container.appendChild(graphContainer);

    // Create mermaid container
    const mermaidDiv = document.createElement('div');
    mermaidDiv.className = 'mermaid';
    mermaidDiv.style.width = '100%';
    mermaidDiv.style.height = '100%';
    graphContainer.appendChild(mermaidDiv);

    // Generate mermaid code
    let mermaidCode = `flowchart LR\n`;
    
    // Add nodes with clean syntax and proper text wrapping
    data.nodes.forEach(node => {
        const wrappedLabel = wrapText(node.label, 10);
        // Using clean node syntax with <br/> for line breaks
        const formattedLabel = wrappedLabel.replace(/\n/g, '<br/>');
        mermaidCode += `    ${node.id}["${formattedLabel}"]\n`;
        // Add clean styling without stroke
        mermaidCode += `    style ${node.id} fill:${styles[getCategoryInRussian(node.category)]},stroke:none,color:black,font-size:14px\n`;
    });
    
    // Add connections with thicker lines for better visibility
    data.links.forEach((link, index) => {
        if (link.bidirectional) {
            mermaidCode += `    ${link.source} <==> ${link.target}\n`;
        } else {
            mermaidCode += `    ${link.source} ==> ${link.target}\n`;
        }
        // Thicker lines for connections
        mermaidCode += `    linkStyle ${index} stroke-width:2px\n`;
    });

    mermaidDiv.textContent = mermaidCode;

    // Configure mermaid
    mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 30,
            rankSpacing: 50,
            diagramPadding: 8
        }
    });

    // Add CSS
    const style = document.createElement('style');
    style.textContent = `
        #graph-container {
            background-color: white;
        }
        .mermaid {
            background-color: white;
        }
        .mermaid svg {
            max-width: 100%;
            height: auto;
        }
        .mermaid .node rect {
            rx: 5px;
            ry: 5px;
            width: 120px !important;
            height: 60px !important;
        }
        .mermaid .node text {
            dominant-baseline: middle;
            text-anchor: middle;
            fill: black !important;
        }
        .mermaid .edgePath path {
            stroke: #333 !important;
        }
    `;
    document.head.appendChild(style);

    // Render and add zoom/pan functionality
    mermaid.run().then(() => {
        console.log('Mermaid rendered successfully');
        const svg = graphContainer.querySelector('svg');
        if (!svg) {
            console.error('SVG not found after mermaid rendering');
            return;
        }

        // Set initial SVG size
        svg.style.width = '100%';
        svg.style.height = '100%';

        // Add zoom and pan functionality
        let zoom = 1;
        const zoomSpeed = 0.1;
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;

        graphContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
            zoom = Math.max(0.1, Math.min(2, zoom + delta));
            updateTransform();
        });

        graphContainer.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                e.preventDefault();
                isDragging = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
            }
        });

        graphContainer.addEventListener('mousemove', (e) => {
            if (isDragging) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        graphContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        function updateTransform() {
            svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoom})`;
        }

        // Calculate and set initial scale
        const svgBBox = svg.getBBox();
        const containerWidth = graphContainer.clientWidth;
        const containerHeight = graphContainer.clientHeight;
        const scaleX = containerWidth / (svgBBox.width + 100);
        const scaleY = containerHeight / (svgBBox.height + 100);
        zoom = Math.min(scaleX, scaleY, 1);
        updateTransform();
    }).catch(error => {
        console.error('Mermaid rendering error:', error);
    });
}

// Improved text wrapping function
function wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = [];
    let currentLength = 0;

    words.forEach(word => {
        if (currentLength + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
            lines.push(currentLine.join(' '));
            currentLine = [word];
            currentLength = word.length;
        } else {
            currentLine.push(word);
            currentLength += word.length + (currentLine.length > 0 ? 1 : 0);
        }
    });
    
    if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
    }

    return lines.join('\n');
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
