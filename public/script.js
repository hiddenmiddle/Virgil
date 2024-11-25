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
        // Clear previous content and show loading
        const graphContainer = document.getElementById('graph-container');
        graphContainer.innerHTML = '<div class="loading">Processing...</div>';
        
        // Send request to create analysis
        const createFunction = httpsCallable(functions, 'create_pbt_conceptualization');
        await createFunction({
            conversation,
            clientId: selectedClient,
            sessionNumber: selectedSession
        });
        
        // Listen for changes to the analysis status
        const statusRef = ref(database, `conceptualizations/${selectedClient}/sessions/${selectedSession}`);
        const unsubscribe = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            switch(data.status) {
                case 'processing':
                    // Already showing loading indicator
                    break;
                    
                case 'completed':
                    // Clear the loading message
                    graphContainer.innerHTML = '';
                    
                    // Visualize the graph from database data
                    visualizeGraph({
                        nodes: data.nodes,
                        links: data.edges.map(edge => ({
                            source: edge.from,
                            target: edge.to,
                            importance: edge.strength
                        }))
                    });
                    
                    // Unsubscribe from further updates once completed
                    unsubscribe();
                    break;
                    
                case 'error':
                    graphContainer.innerHTML = `<div class="error">Error: ${data.error_message}</div>`;
                    unsubscribe();
                    break;
            }
        });
        
    } catch (error) {
        console.error('Detailed error:', error);
        document.getElementById('graph-container').innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
};

// Visualize graph using D3.js
function visualizeGraph(data) {
    const container = document.getElementById('graph-container');
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const legendWidth = 200; // Width for the legend panel
    
    // Clear existing visualization
    d3.select('#graph-container').selectAll('*').remove();
    
    // Create SVG container
    const svg = d3.select('#graph-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
        
    // Add legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(10,20)`);
        
    const categories = [
        'Attentional processes',
        'Cognitive sphere',
        'Affective sphere',
        'Selfing',
        'Motivation',
        'Overt behavior',
        'Biophysiological context',
        'Situational context',
        'Personal history',
        'Broader socio-cultural and economical context'
    ];
    
    // Create legend items
    legend.selectAll('rect')
        .data(categories)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d, i) => i * 25)
        .attr('width', 20)
        .attr('height', 20)
        .attr('fill', d => getCategoryColor(d));
        
    legend.selectAll('text')
        .data(categories)
        .enter()
        .append('text')
        .attr('x', 25)
        .attr('y', (d, i) => i * 25 + 15)
        .text(d => d)
        .attr('font-size', '12px');
        
    // Create main visualization area
    const mainGroup = svg.append('g')
        .attr('transform', `translate(${legendWidth + 20}, 20)`);
        
    // Calculate layout
    const nodeWidth = 150;
    const nodeHeight = 80;
    const horizontalSpacing = 200;
    const verticalSpacing = 100;
    const nodesPerColumn = Math.ceil(Math.sqrt(data.nodes.length));
    
    // Position nodes in a grid layout
    data.nodes.forEach((node, i) => {
        const column = Math.floor(i / nodesPerColumn);
        const row = i % nodesPerColumn;
        node.x = column * horizontalSpacing;
        node.y = row * verticalSpacing;
    });
    
    // Create arrow marker for links
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999');
        
    // Draw links with arrows
    const links = mainGroup.selectAll('path')
        .data(data.links)
        .enter()
        .append('path')
        .attr('d', d => {
            const sourceNode = data.nodes.find(n => n.id === d.source);
            const targetNode = data.nodes.find(n => n.id === d.target);
            return `M${sourceNode.x + nodeWidth/2},${sourceNode.y + nodeHeight/2} 
                    L${targetNode.x + nodeWidth/2},${targetNode.y + nodeHeight/2}`;
        })
        .attr('stroke', '#999')
        .attr('stroke-width', d => d.importance)
        .attr('fill', 'none')
        .attr('marker-end', 'url(#arrowhead)');
        
    // Draw nodes as rectangles with labels
    const nodes = mainGroup.selectAll('g')
        .data(data.nodes)
        .enter()
        .append('g')
        .attr('transform', d => `translate(${d.x},${d.y})`);
        
    nodes.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('fill', d => getCategoryColor(d.category))
        .attr('rx', 5)  // Rounded corners
        .attr('ry', 5);
        
    nodes.append('text')
        .attr('x', nodeWidth/2)
        .attr('y', nodeHeight/2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '12px')
        .text(d => d.label)
        .call(wrapText, nodeWidth - 10);
}

// Helper function to wrap text
function wrapText(text, width) {
    text.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/);
        const lineHeight = 1.1;
        const y = text.attr('y');
        let line = [];
        let lineNumber = 0;
        
        const tspan = text.text(null)
            .append('tspan')
            .attr('x', text.attr('x'))
            .attr('y', y)
            .attr('dy', 0);
            
        words.forEach(word => {
            line.push(word);
            tspan.text(line.join(' '));
            
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(' '));
                line = [word];
                tspan = text.append('tspan')
                    .attr('x', text.attr('x'))
                    .attr('y', y)
                    .attr('dy', ++lineNumber * lineHeight + 'em')
                    .text(word);
            }
        });
    });
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
