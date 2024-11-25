import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCRp3so36_GSz9wCCOkVIF1DJtWvw6GVxQ",
    authDomain: "virgil-110a0.firebaseapp.com",
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
const createBtn = document.getElementById('createBtn');

// Load existing clients
async function loadClients() {
    const ref = database.ref('conceptualizations');
    const snapshot = await onValue(ref);
    const clients = snapshot.val() || {};
    
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
}

// Load sessions for selected client
async function loadSessions(clientId) {
    const ref = database.ref(`conceptualizations/${clientId}/sessions`);
    const snapshot = await onValue(ref);
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
}

// Create new conceptualization
createBtn.onclick = async () => {
    const conversation = textarea.value;
    const clientId = document.querySelector('.dropbtn').textContent;
    const sessionNumber = document.querySelector('.dropbtn:nth-child(2)').textContent.split(' ')[1];
    
    if (!conversation || clientId === 'Client' || !sessionNumber) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const createFunction = httpsCallable(functions, 'create_pbt_conceptualization');
        const result = await createFunction({
            conversation,
            clientId,
            sessionNumber
        });
        
        if (result.data.success) {
            visualizeGraph(result.data.data);
        } else {
            throw new Error(result.data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating conceptualization');
    }
};

// Visualize graph using D3.js
function visualizeGraph(data) {
    const width = document.getElementById('graph-container').offsetWidth;
    const height = document.getElementById('graph-container').offsetHeight;
    
    // Clear existing visualization
    d3.select('#graph-container').selectAll('*').remove();
    
    const svg = d3.select('#graph-container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
        
    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));
        
    // Add links
    const links = svg.append('g')
        .selectAll('line')
        .data(data.links)
        .enter()
        .append('line')
        .attr('stroke', '#999')
        .attr('stroke-width', d => d.importance);
        
    // Add nodes
    const nodes = svg.append('g')
        .selectAll('g')
        .data(data.nodes)
        .enter()
        .append('g');
        
    nodes.append('rect')
        .attr('width', 120)
        .attr('height', 60)
        .attr('fill', d => getCategoryColor(d.category));
        
    nodes.append('text')
        .text(d => d.content)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '10px')
        .call(wrap, 110);
        
    // Update positions
    simulation.on('tick', () => {
        links
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
            
        nodes
            .attr('transform', d => `translate(${d.x-60},${d.y-30})`);
    });
}

// Load initial data
loadClients();
